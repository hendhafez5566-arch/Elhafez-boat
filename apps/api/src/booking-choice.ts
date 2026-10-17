/** Tenant-scoped customer booking catalog and provisional request creation.
 * All calls must run in the already-scoped PostgreSQL transaction; never trust
 * WhatsApp action labels or client-supplied prices/currencies.
 */
import { HttpFailure, isUuid, type SqlClient } from './services.js';

export type BookingChoice = { programId: string; departureId?: string | null; roomPackageId?: string | null };
export type DepartureChoice = { id: string; depart_at: string; return_at: string; seats_total: number; seats_booked: number };
export type RoomChoice = { id: string; hotel_name: string; room_type: string; occupancy: number; nights: number; units_total: number; units_booked: number; price_minor: string; currency: string };
const validateIds = (choice: BookingChoice) => {
  if (!isUuid(choice.programId) || (choice.departureId != null && !isUuid(choice.departureId)) || (choice.roomPackageId != null && !isUuid(choice.roomPackageId)) || (choice.roomPackageId && !choice.departureId)) {
    throw new HttpFailure(400, 'Invalid program or departure or room selection');
  }
};
const validatedPage = (page: number) => {
  if (!Number.isSafeInteger(page) || page < 0 || page > 999) throw new HttpFailure(400, 'Invalid catalog page');
  return page;
};
export async function hasDepartures(db: SqlClient, tenantId: string, programId: string): Promise<boolean> {
  if (!isUuid(programId)) throw new HttpFailure(400, 'Invalid program');
  const r = await db.query('SELECT 1 FROM program_departures WHERE tenant_id=$1 AND program_id=$2 LIMIT 1',[tenantId,programId]);
  return r.rowCount === 1;
}
export async function departurePage(db: SqlClient,tenantId:string,programId:string,page:number):Promise<{items:DepartureChoice[];next:boolean}>{
  if (!isUuid(programId)) throw new HttpFailure(400,'Invalid program');
  const offset=validatedPage(page)*7;
  const r=await db.query(`SELECT d.id,d.depart_at,d.return_at,d.seats_total,d.seats_booked
    FROM program_departures d JOIN programs p ON p.tenant_id=d.tenant_id AND p.id=d.program_id
    WHERE d.tenant_id=$1 AND d.program_id=$2 AND p.status='PUBLISHED'
      AND d.status='ACTIVE' AND d.depart_at>now() AND d.seats_total>d.seats_booked
    ORDER BY d.depart_at,d.id LIMIT 8 OFFSET $3`,[tenantId,programId,offset]);
  return {items:r.rows.slice(0,7) as DepartureChoice[],next:r.rows.length>7};
}
export async function hasRoomPackages(db:SqlClient,tenantId:string,programId:string,departureId:string):Promise<boolean>{
  const r=await db.query('SELECT 1 FROM program_room_packages WHERE tenant_id=$1 AND program_id=$2 AND departure_id=$3 LIMIT 1',[tenantId,programId,departureId]);
  return r.rowCount===1;
}
export async function roomPage(db:SqlClient,tenantId:string,programId:string,departureId:string,page:number):Promise<{items:RoomChoice[];next:boolean}>{
  if (![programId,departureId].every(isUuid)) throw new HttpFailure(400,'Invalid program/departure');
  const offset=validatedPage(page)*7;
  const r=await db.query(`SELECT r.id,r.hotel_name,r.room_type,r.occupancy,r.nights,r.units_total,r.units_booked,
       r.price_minor::text AS price_minor,r.currency
    FROM program_room_packages r JOIN program_departures d ON d.tenant_id=r.tenant_id AND d.id=r.departure_id
    JOIN programs p ON p.tenant_id=d.tenant_id AND p.id=d.program_id
    WHERE r.tenant_id=$1 AND r.program_id=$2 AND r.departure_id=$3
      AND d.status='ACTIVE' AND d.depart_at>now() AND d.seats_total>d.seats_booked
      AND p.status='PUBLISHED' AND r.units_total>r.units_booked
    ORDER BY r.hotel_name,r.price_minor,r.id LIMIT 8 OFFSET $4`,[tenantId,programId,departureId,offset]);
  return {items:r.rows.slice(0,7) as RoomChoice[],next:r.rows.length>7};
}
export async function validateDepartureChoice(db:SqlClient,tenantId:string,programId:string,departureId:string):Promise<boolean>{
  if (![programId,departureId].every(isUuid)) return false;
  const r=await db.query(`SELECT 1 FROM program_departures d JOIN programs p ON p.tenant_id=d.tenant_id AND p.id=d.program_id
    WHERE d.tenant_id=$1 AND d.program_id=$2 AND d.id=$3 AND d.status='ACTIVE'
      AND d.depart_at>now() AND d.seats_total>d.seats_booked AND p.status='PUBLISHED'`,[tenantId,programId,departureId]);
  return r.rowCount===1;
}
export async function validateRoomChoice(db:SqlClient,tenantId:string,programId:string,departureId:string,roomPackageId:string):Promise<boolean>{
  if (![programId,departureId,roomPackageId].every(isUuid)) return false;
  const r=await db.query(`SELECT 1 FROM program_room_packages r JOIN program_departures d ON d.tenant_id=r.tenant_id AND d.id=r.departure_id
    WHERE r.tenant_id=$1 AND r.program_id=$2 AND r.departure_id=$3 AND r.id=$4
      AND d.status='ACTIVE' AND d.depart_at>now() AND r.units_total>r.units_booked`,[tenantId,programId,departureId,roomPackageId]);
  return r.rowCount===1;
}
export async function createCustomerBooking(db: SqlClient,tenantId:string,phone:string,customerName:string,partySize:number,choice:BookingChoice):Promise<string>{
  validateIds(choice);
  if (!/^\+?[0-9]{8,15}$/.test(phone)||customerName.trim().length<2||customerName.trim().length>120||
      !Number.isSafeInteger(partySize)||partySize<1||partySize>100) throw new HttpFailure(400,'Invalid customer booking input');
  const main=await db.query(`SELECT id,price_minor::text AS price_minor,currency,available_seats,booked_seats
    FROM programs WHERE tenant_id=$1 AND id=$2 AND status='PUBLISHED' FOR SHARE`,[tenantId,choice.programId]);
  if(main.rowCount!==1)throw new HttpFailure(404,'Published program unavailable');
  const p=main.rows[0];
  if(Number(p.available_seats)-Number(p.booked_seats)<partySize)throw new HttpFailure(409,'Program capacity unavailable');
  const configuredDepartures=await hasDepartures(db,tenantId,choice.programId);
  if(configuredDepartures && !choice.departureId)throw new HttpFailure(409,'Choose a departure for this program');
  if(!configuredDepartures && choice.departureId)throw new HttpFailure(409,'This program has no active departures');
  let rate=p.price_minor,currency=p.currency,roomUnits:number|null=null;
  if(choice.departureId){
    const dr=await db.query(`SELECT seats_total,seats_booked FROM program_departures
      WHERE tenant_id=$1 AND program_id=$2 AND id=$3 AND status='ACTIVE' AND depart_at>now() FOR SHARE`,[tenantId,choice.programId,choice.departureId]);
    if(dr.rowCount!==1||Number(dr.rows[0].seats_total)-Number(dr.rows[0].seats_booked)<partySize)throw new HttpFailure(409,'Departure seats unavailable');
    const configuredRooms=await hasRoomPackages(db,tenantId,choice.programId,choice.departureId);
    if(configuredRooms && !choice.roomPackageId)throw new HttpFailure(409,'Choose a room package for this departure');
    if(choice.roomPackageId){
      const rr=await db.query(`SELECT occupancy,units_total,units_booked,price_minor::text AS price_minor,currency
        FROM program_room_packages WHERE tenant_id=$1 AND program_id=$2 AND departure_id=$3 AND id=$4 FOR SHARE`,
        [tenantId,choice.programId,choice.departureId,choice.roomPackageId]);
      if(rr.rowCount!==1)throw new HttpFailure(409,'Selected room no longer available');
      const room=rr.rows[0];roomUnits=Math.ceil(partySize/Number(room.occupancy));
      if(roomUnits>Number(room.units_total)-Number(room.units_booked))throw new HttpFailure(409,'Room allocation insufficient');
      rate=room.price_minor;currency=room.currency;
    }
  }
  const saved=await db.query(`INSERT INTO booking_requests(tenant_id,program_id,customer_name,customer_phone,party_size,
    price_minor_snapshot,currency_snapshot,departure_id,room_package_id,room_units)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
  [tenantId,choice.programId,customerName.trim(),phone,partySize,rate,currency,choice.departureId??null,choice.roomPackageId??null,roomUnits]);
  return String(saved.rows[0].id);
}