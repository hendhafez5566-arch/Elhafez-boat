import { allow, HttpFailure, type Actor, type SqlClient } from './services.js';

export async function teamMembers(db:SqlClient,actor:Actor){
  allow(actor,['OWNER','MANAGER']);
  return (await db.query(`SELECT u.id,u.email,m.role,u.created_at AS "createdAt" FROM memberships m JOIN users u ON u.id=m.user_id
    WHERE m.tenant_id=$1 ORDER BY CASE m.role WHEN 'OWNER' THEN 0 WHEN 'MANAGER' THEN 1 ELSE 2 END,u.created_at LIMIT 200`,[actor.tenantId])).rows;
}