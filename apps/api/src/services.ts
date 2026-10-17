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
export function cleanProgramInput(data: unknown): { title: string; category: string; currency: string; priceMinor: number; availableSeats: number; summary: string; hotelName: string | null; durationDays: number | null; departureAt: string | null } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpFailure(400,'Invalid program data');
  const d = data as Record<string, unknown>;
  const title = typeof d.title === 'string' ? d.title.trim() : '';
  if (!title || title.length > 160) throw new HttpFailure(400,'Program title must be 1-160 characters');
  if (!categories.has(d.category as string)) throw new HttpFailure(400,'Invalid category');
  if (!currencies.has(d.currency as string)) throw new HttpFailure(400,'Invalid currency');
  if (!Number.isSafeInteger(d.priceMinor) || (d.priceMinor as number) < 0) throw new HttpFailure(400,'Invalid price');
  if (!Number.isSafeInteger(d.availableSeats) || (d.availableSeats as number) < 0 || (d.availableSeats as number)>100000) throw new HttpFailure(400,'Invalid capacity');
  const summary = d.summary === undefined || d.summary === null ? '' : typeof d.summary === 'string' ? d.summary.trim() : null;
  if(summary===null || summary.length>2000)throw new HttpFailure(400,'Invalid program summary');
  const hotelName = d.hotelName === undefined || d.hotelName === null || d.hotelName === '' ? null : typeof d.hotelName === 'string' ? d.hotelName.trim() : null;
  if(hotelName!==null && (hotelName.length<2||hotelName.length>160))throw new HttpFailure(400,'Invalid hotel name');
  const durationDays = d.durationDays === undefined || d.durationDays === null || d.durationDays === '' ? null : Number(d.durationDays);
  if(durationDays!==null && (!Number.isSafeInteger(durationDays)||durationDays<1||durationDays>90))throw new HttpFailure(400,'Invalid duration');
  let departureAt: string|null = null;
  if(d.departureAt !== undefined && d.departureAt !== null && d.departureAt !== '') {
    if(typeof d.departureAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(d.departureAt))throw new HttpFailure(400,'Invalid departure date');
    const timestamp=new Date(d.departureAt);
    if(!Number.isFinite(timestamp.getTime()))throw new HttpFailure(400,'Invalid departure date');
    departureAt=timestamp.toISOString();
  }
  return { title, category: d.category as string, currency: d.currency as string, priceMinor: d.priceMinor as number, availableSeats: d.availableSeats as number, summary, hotelName, durationDays, departureAt };
}
export function cleanBookingInput(data: unknown): { programId: string; customerName: string; customerPhone: string; partySize: number; departureId: string|null; roomPackageId: string|null } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new HttpFailure(400,'Invalid booking');
  const d = data as Record<string, unknown>;
  const customerName = typeof d.customerName === 'string' ? d.customerName.trim() : '';
  const customerPhone = typeof d.customerPhone === 'string' ? d.customerPhone.trim() : '';
  if (!isUuid(d.programId)) throw new HttpFailure(400,'Invalid program ID');
  if (customerName.length < 2 || customerName.length > 120) throw new HttpFailure(400,'Invalid customer name');
  if (!/^\\+?[0-9]{8,15}$/.test(customerPhone)) throw new HttpFailure(400,'Invalid phone');
  if (!Number.isSafeInteger(d.partySize) || (d.partySize as number) < 1 || (d.partySize as number) > 100) throw new HttpFailure(400,'Invalid party size');
  const departureId=d.departureId===undefined||d.departureId===null||d.departureId===''?null:d.departureId;
  const roomPackageId=d.roomPackageId===undefined||d.roomPackageId===null||d.roomPackageId===''?null:d.roomPackageId;
  if((departureId!==null&&!isUuid(departureId))||(roomPackageId!==null&&!isUuid(roomPackageId))||(roomPackageId!==null&&departureId===null))
    throw new HttpFailure(400,'Invalid departure or room package');
  return { programId:d.programId,customerName,customerPhone,partySize:d.partySize as number,departureId,roomPackageId };
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
    available_seats, booked_seats, status,summary,hotel_name,duration_days,departure_at FROM programs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200`,[actor.tenantId]);
  return result.rows;
}
export async function createProgram(db: SqlClient, actor: Actor, data: unknown): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER']);
  const p = cleanProgramInput(data);
  const subscription=await db.query(`SELECT s.status,p.max_programs FROM tenant_subscriptions s JOIN subscription_plans p ON p.code=s.plan_code WHERE s.tenant_id=$1`,[actor.tenantId]);
  if(subscription.rowCount){
    if(['SUSPENDED','CANCELLED'].includes(String(subscription.rows[0].status)))throw new HttpFailure(403,'Company subscription is not active');
    const used=await db.query('SELECT count(*) AS total FROM programs WHERE tenant_id=$1',[actor.tenantId]);
    if(Number(used.rows[0].total)>=Number(subscription.rows[0].max_programs))throw new HttpFailure(409,'Program limit reached for current plan');
  }
  const result = await db.query(`INSERT INTO programs (tenant_id,title,category,currency,price_minor,available_seats,status,summary,hotel_name,duration_days,departure_at)
    VALUES ($1,$2,$3,$4,$5,$6,'DRAFT',$7,$8,$9,$10)
    RETURNING id,title,category,currency,price_minor::text AS "priceMinor",available_seats,status,summary,hotel_name,duration_days,departure_at`,
    [actor.tenantId,p.title,p.category,p.currency,p.priceMinor,p.availableSeats,p.summary,p.hotelName,p.durationDays,p.departureAt]);
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
    currency_snapshot,status,departure_id,room_package_id,room_units,created_at FROM booking_requests WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 200`,[actor.tenantId]);
  return result.rows;
}
export async function createBooking(db: SqlClient, actor: Actor, data: unknown): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER','AGENT']);
  const b=cleanBookingInput(data);
  const found=await db.query(`SELECT price_minor::text AS price_minor,currency,available_seats,booked_seats
    FROM programs WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' FOR SHARE`,[actor.tenantId,b.programId]);
  if(found.rowCount!==1)throw new HttpFailure(404,'Published program not found');
  const p=found.rows[0];
  if(b.partySize>Number(p.available_seats)-Number(p.booked_seats))throw new HttpFailure(409,'Insufficient remaining program capacity');
  if(b.departureId){
    const departure=await db.query(`SELECT seats_total,seats_booked FROM program_departures WHERE tenant_id=$1 AND program_id=$2 AND id=$3 AND status='ACTIVE' FOR SHARE`,[actor.tenantId,b.programId,b.departureId]);
    if(departure.rowCount!==1)throw new HttpFailure(404,'Active departure not found');
    if(b.partySize>Number(departure.rows[0].seats_total)-Number(departure.rows[0].seats_booked))throw new HttpFailure(409,'Insufficient departure capacity');
  }
  let rateMinor=p.price_minor,rateCurrency=p.currency,roomUnits:number|null=null;
  if(b.roomPackageId){
    const room=await db.query(`SELECT occupancy,units_total,units_booked,price_minor,currency FROM program_room_packages WHERE tenant_id=$1 AND program_id=$2 AND departure_id=$3 AND id=$4 FOR SHARE`,[actor.tenantId,b.programId,b.departureId,b.roomPackageId]);
    if(room.rowCount!==1)throw new HttpFailure(404,'Room package not found');
    const r=room.rows[0];roomUnits=Math.ceil(b.partySize/Number(r.occupancy));
    if(!Number.isSafeInteger(roomUnits)||roomUnits>Number(r.units_total)-Number(r.units_booked))throw new HttpFailure(409,'Insufficient room capacity');
    rateMinor=r.price_minor;rateCurrency=r.currency;
  }
  const result=await db.query(`INSERT INTO booking_requests(tenant_id,program_id,customer_name,customer_phone,party_size,price_minor_snapshot,currency_snapshot,departure_id,room_package_id,room_units)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
    RETURNING id,status,program_id,party_size,price_minor_snapshot::text AS "priceMinorSnapshot",currency_snapshot,departure_id,room_package_id,room_units`,
    [actor.tenantId,b.programId,b.customerName,b.customerPhone,b.partySize,rateMinor,rateCurrency,b.departureId,b.roomPackageId,roomUnits]);
  return result.rows[0];
}
/** Atomically confirms program, departure, and room allocation. Caller owns transaction. */
export async function confirmBooking(db: SqlClient, actor: Actor, bookingId: string): Promise<Record<string, unknown>> {
  allow(actor,['OWNER','MANAGER']);
  if(!isUuid(bookingId))throw new HttpFailure(400,'Invalid booking ID');
  const found=await db.query(`SELECT id,program_id,party_size,status,departure_id,room_package_id,room_units FROM booking_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[actor.tenantId,bookingId]);
  if(found.rowCount!==1)throw new HttpFailure(404,'Booking not found');
  const b=found.rows[0];
  if(b.status==='CONFIRMED')return {id:b.id,status:'CONFIRMED',alreadyConfirmed:true};
  if(b.status!=='PENDING_REVIEW')throw new HttpFailure(409,'Booking is not pending');
  const program=await db.query(`UPDATE programs SET booked_seats=booked_seats+$3,updated_at=now()
    WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' AND booked_seats+$3<=available_seats RETURNING id`,
    [actor.tenantId,b.program_id,b.party_size]);
  if(program.rowCount!==1)throw new HttpFailure(409,'Insufficient program capacity or unpublished');
  if(b.departure_id){
    const depart=await db.query(`UPDATE program_departures SET seats_booked=seats_booked+$3
    WHERE tenant_id=$1 AND id=$2 AND status='ACTIVE' AND seats_booked+$3<=seats_total RETURNING id`,
    [actor.tenantId,b.departure_id,b.party_size]);
    if(depart.rowCount!==1)throw new HttpFailure(409,'Insufficient departure capacity');
  }
  if(b.room_package_id){
    const room=await db.query(`UPDATE program_room_packages SET units_booked=units_booked+$3
    WHERE tenant_id=$1 AND id=$2 AND units_booked+$3<=units_total RETURNING id`,
    [actor.tenantId,b.room_package_id,b.room_units]);
    if(room.rowCount!==1)throw new HttpFailure(409,'Insufficient room capacity');
  }
  const done=await db.query(`UPDATE booking_requests SET status='CONFIRMED' WHERE tenant_id=$1 AND id=$2 AND status='PENDING_REVIEW' RETURNING id,status`,[actor.tenantId,bookingId]);
  if(done.rowCount!==1)throw new HttpFailure(409,'Booking status conflict');
  await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'BOOKING_CONFIRMED','booking',$3)`,[actor.tenantId,actor.userId,bookingId]);
  return done.rows[0];
}
export async function cancelBooking(db:SqlClient,actor:Actor,bookingId:string):Promise<Record<string,unknown>>{
  allow(actor,['OWNER','MANAGER']);
  if(!isUuid(bookingId))throw new HttpFailure(400,'Invalid booking ID');
  const found=await db.query(`SELECT id,program_id,party_size,status,departure_id,room_package_id,room_units FROM booking_requests WHERE tenant_id=$1 AND id=$2 FOR UPDATE`,[actor.tenantId,bookingId]);
  if(found.rowCount!==1)throw new HttpFailure(404,'Booking not found');
  const b=found.rows[0];if(b.status==='CANCELLED')return {id:b.id,status:'CANCELLED',alreadyCancelled:true};
  if(!['PENDING_REVIEW','CONFIRMED'].includes(String(b.status)))throw new HttpFailure(409,'Booking cannot be cancelled');
  if(b.status==='CONFIRMED'){
    const p=await db.query(`UPDATE programs SET booked_seats=booked_seats-$3 WHERE tenant_id=$1 AND id=$2 AND booked_seats>=$3 RETURNING id`,[actor.tenantId,b.program_id,b.party_size]);
    if(p.rowCount!==1)throw new HttpFailure(409,'Program seats cannot be released');
    if(b.departure_id){
      const d=await db.query(`UPDATE program_departures SET seats_booked=seats_booked-$3 WHERE tenant_id=$1 AND id=$2 AND seats_booked>=$3 RETURNING id`,[actor.tenantId,b.departure_id,b.party_size]);
      if(d.rowCount!==1)throw new HttpFailure(409,'Departure seats cannot be released');
    }
    if(b.room_package_id){
      const r=await db.query(`UPDATE program_room_packages SET units_booked=units_booked-$3 WHERE tenant_id=$1 AND id=$2 AND units_booked>=$3 RETURNING id`,[actor.tenantId,b.room_package_id,b.room_units]);
      if(r.rowCount!==1)throw new HttpFailure(409,'Room units cannot be released');
    }
  }
  const done=await db.query(`UPDATE booking_requests SET status='CANCELLED' WHERE tenant_id=$1 AND id=$2 RETURNING id,status`,[actor.tenantId,bookingId]);
  await db.query(`INSERT INTO audit_events(tenant_id,actor_id,action,entity_type,entity_id) VALUES($1,$2,'BOOKING_CANCELLED','booking',$3)`,[actor.tenantId,actor.userId,bookingId]);
  return done.rows[0];
}
