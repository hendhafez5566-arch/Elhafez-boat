/** Tenant-scoped business services. All callers MUST use withTenantTransaction. */
export type Role = 'OWNER' | 'MANAGER' | 'AGENT' | 'VIEWER';
export interface Actor { tenantId: string; userId: string; role: Role }
export interface SqlResult { rows: Record<string, unknown>[]; rowCount: number | null }
export interface SqlClient { query(sql: string, params?: readonly unknown[]): Promise<SqlResult> }
export interface TransactionClient extends SqlClient { release(): void }
export interface SqlPool { connect(): Promise<TransactionClient> }

export class HttpFailure extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const categories = new Set(['UMRAH','HAJJ','DOMESTIC','INTERNATIONAL']);
const currencies = new Set(['EGP','SAR','USD','EUR','AED']);
const roles: Role[] = ['OWNER','MANAGER','AGENT','VIEWER'];
export function isUuid(id: unknown): id is string { return typeof id === 'string' && uuid.test(id); }
export function assertActor(actor: Actor): void {
  if (!isUuid(actor.tenantId) || !isUuid(actor.userId) || !roles.includes(actor.role)) throw new HttpFailure(401,'Invalid identity');
}
export function allow(actor: Actor, accepted: readonly Role[]): void {
  assertActor(actor);
  if (!accepted.includes(actor.role)) throw new HttpFailure(403,'Insufficient permissions');
}
export function cleanProgramInput(data: unknown): { title: string; category: string; currency: string; priceMinor: number; availableSeats: number } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpFailure(400,'Invalid program data');
  const d = data as Record<string, unknown>;
  const title = typeof d.title === 'string' ? d.title.trim() : '';
  if (!title || title.length > 160) throw new HttpFailure(400,'Program title must be 1-160 characters');
  if (!categories.has(d.category as string)) throw new HttpFailure(400,'Invalid category');
  if (!currencies.has(d.currency as string)) throw new HttpFailure(400,'Invalid currency');
  if (!Number.isSafeInteger(d.priceMinor) || (d.priceMinor as number) < 0) throw new HttpFailure(400,'Invalid price');
  if (!Number.isSafeInteger(d.availableSeats) || (d.availableSeats as number) < 0 || (d.availableSeats as number)>100000) throw new HttpFailure(400,'Invalid capacity');
  return { title, category: d.category as string, currency: d.currency as string, priceMinor: d.priceMinor as number, availableSeats: d.availableSeats as number };
}
export function cleanBookingInput(data: unknown): { programId: string; customerName: string; customerPhone: string; partySize: number } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpFailure(400,'Invalid booking');
  const d = data as Record<string, unknown>;
  const customerName = typeof d.customerName === 'string' ? d.customerName.trim() : '';
  const customerPhone = typeof d.customerPhone === 'string' ? d.customerPhone.trim() : '';
  if (!isUuid(d.programId)) throw new HttpFailure(400,'Invalid program ID');
  if (customerName.length < 2 || customerName.length > 120) throw new HttpFailure(400,'Invalid customer name');
  if (!/^\+?[0-9]{8,15}$/.test(customerPhone)) throw new HttpFailure(400,'Invalid phone');
  if (!Number.isSafeInteger(d.partySize) || (d.partySize as number) < 1 || (d.partySize as number) > 100) throw new HttpFailure(400,'Invalid party size');
  return { programId: d.programId, customerName, customerPhone, partySize: d.partySize as number };
}
/** Sets PostgreSQL RLS scope ONLY inside a transaction. Never accept tenant ID from request body. */
export async function withTenantTransaction<T>(pool: SqlPool, actor: Actor, task: (tx: SqlClient) => Promise<T>): Promise<T> {
  assertActor(actor);
  const client = await pool.connect();
  let began = false;
  try {
    await client.query('BEGIN');
    began = true;
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [actor.tenantId]);
    const value = await task(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    if (began) {
      try { await client.query('ROLLBACK'); } catch { /* original failure takes precedence */ }
    }
    throw error;
  } finally {
    client.release();
  }
}
export async function listPrograms(db: SqlClient, actor: Actor): Promise<Record<string, unknown>[]> {
  allow(actor, roles);
  const result = await db.query(`SELECT id, title, category, currency, price_minor::text AS "priceMinor",
    available_seats, booked_seats, status FROM programs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200`,[actor.tenantId]);
  return result.rows;
}
export async function createProgram(db: SqlClient, actor: Actor, data: unknown): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER']);
  const p = cleanProgramInput(data);
  const result = await db.query(`INSERT INTO programs (tenant_id,title,category,currency,price_minor,available_seats,status)
    VALUES ($1,$2,$3,$4,$5,$6,'DRAFT') RETURNING id,title,category,currency,price_minor::text AS "priceMinor",available_seats,status`,
    [actor.tenantId,p.title,p.category,p.currency,p.priceMinor,p.availableSeats]);
  return result.rows[0];
}
export async function publishProgram(db: SqlClient, actor: Actor, programId: string): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER']);
  if (!isUuid(programId)) throw new HttpFailure(400,'Invalid program ID');
  const result=await db.query(`UPDATE programs SET status='PUBLISHED',updated_at=now() WHERE tenant_id=$1 AND id=$2
    AND status IN ('DRAFT','PUBLISHED') AND available_seats>booked_seats
    RETURNING id,status`,[actor.tenantId,programId]);
  if (result.rowCount!==1) throw new HttpFailure(409,'Program unavailable or no remaining capacity');
  return result.rows[0];
}
export async function listBookings(db: SqlClient, actor: Actor): Promise<Record<string, unknown>[]> {
  allow(actor,roles);
  const result=await db.query(`SELECT id,program_id,customer_name,customer_phone,party_size,price_minor_snapshot::text AS "priceMinorSnapshot",
    currency_snapshot,status,created_at FROM booking_requests WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200`,[actor.tenantId]);
  return result.rows;
}
export async function createBooking(db: SqlClient, actor: Actor, data: unknown): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER','AGENT']);
  const b=cleanBookingInput(data);
  const found=await db.query(`SELECT price_minor::text AS price_minor,currency,available_seats,booked_seats
    FROM programs WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' FOR SHARE`,[actor.tenantId,b.programId]);
  if (found.rowCount!==1) throw new HttpFailure(404,'Published program not found');
  const p=found.rows[0];
  if (b.partySize>Number(p.available_seats)-Number(p.booked_seats)) throw new HttpFailure(409,'Insufficient remaining capacity');
  const result=await db.query(`INSERT INTO booking_requests(tenant_id,program_id,customer_name,customer_phone,party_size,price_minor_snapshot,currency_snapshot)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,status,program_id,party_size,price_minor_snapshot::text AS "priceMinorSnapshot",currency_snapshot`,
    [actor.tenantId,b.programId,b.customerName,b.customerPhone,b.partySize,p.price_minor,p.currency]);
  return result.rows[0];
}
/** Must be called in same tenant transaction; row lock and conditional UPDATE stop double confirmation / oversell. */
export async function confirmBooking(db: SqlClient, actor: Actor, bookingId: string): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER']);
  if (!isUuid(bookingId)) throw new HttpFailure(400,'Invalid booking ID');
  const found=await db.query(`SELECT id,program_id,party_size,status FROM booking_requests
    WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[actor.tenantId,bookingId]);
  if (found.rowCount!==1) throw new HttpFailure(404,'Booking not found');
  const b=found.rows[0];
  if (b.status==='CONFIRMED') return {id:b.id,status:'CONFIRMED',alreadyConfirmed:true};
  if (b.status!=='PENDING_REVIEW') throw new HttpFailure(409,'Booking is not pending');
  const updated=await db.query(`UPDATE programs SET booked_seats=booked_seats+$3,updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' AND booked_seats+$3<=available_seats RETURNING id`,
    [actor.tenantId,b.program_id,b.party_size]);
  if (updated.rowCount!==1) throw new HttpFailure(409,'Insufficient capacity or program unpublished');
  const result=await db.query(`UPDATE booking_requests SET status='CONFIRMED'
    WHERE tenant_id=$1 AND id=$2 AND status='PENDING_REVIEW' RETURNING id,status`,[actor.tenantId,bookingId]);
  if (result.rowCount!==1) throw new HttpFailure(409,'Booking changed during confirmation');
  return result.rows[0];
}