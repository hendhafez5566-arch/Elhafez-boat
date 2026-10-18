/** Delivery outcomes must be conservative: a server error can follow an accepted send. */
export class DeliveryFailure extends Error {
 constructor(public status?:number){super(status ? 'Meta message API '+status : 'Meta delivery outcome unknown')}
}
export function deliveryDisposition(error:unknown):'UNCERTAIN'|'PENDING'|'FAILED'{
 const status=error instanceof DeliveryFailure?error.status:undefined;
 if(status===429)return 'PENDING';
 if(status!==undefined&&status>=400&&status<500&&status!==408)return 'FAILED';
 return 'UNCERTAIN';
}
/** Transport injection is for isolated tests; production never takes a destination from input/env. */
export async function sendWhatsApp(version:string,phoneNumberId:string,token:string,payload:unknown,transport:typeof fetch=fetch){
 if(!/^v\d{1,2}\.\d{1,2}$/.test(version)||!/^\d+$/.test(phoneNumberId))throw new DeliveryFailure(400);
 let response:Response;
 try{response=await transport(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`,{
  method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)
 })}catch{throw new DeliveryFailure()}
 if(!response.ok){await response.body?.cancel().catch(()=>{});throw new DeliveryFailure(response.status)}
 try{
  // Do not buffer an unbounded/malicious response or retain its contents in logs.
  const reader=response.body?.getReader();if(!reader)throw new Error();
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>65536)throw new Error();chunks.push(part.value)}}finally{await reader.cancel().catch(()=>{})}
  const json=JSON.parse(Buffer.concat(chunks).toString()) as {messages?:Array<{id?:unknown}>};
  const id=json.messages?.[0]?.id;if(typeof id!=='string'||!id||id.length>256)throw new Error();
  return {providerId:id};
 }catch{throw new DeliveryFailure()}
}
