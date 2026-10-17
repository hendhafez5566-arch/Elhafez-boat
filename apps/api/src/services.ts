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
const roles: Role[] = ['OWNER','MANAGER','AGENT','VIEWER'];
export function isUuid(id: unknown): id is string { return typeof id === 'string' && uuid.test(id); }
export function assertActor(actor: Actor): void {
  if (!isUuid(actor.tenantId) || !isUuid(actor.userId) || !roles.includes(actor.role)) throw new HttpFailure(401,'Invalid identity');
}
export function allow(actor: Actor, accepted: readonly Role[]): void {
  assertActor(actor);
  if (!accepted.includes(actor.role)) throw new HttpFailure(403,'Insufficient permissions');
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
