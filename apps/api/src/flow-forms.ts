/** Internal form drafts only; these are not Meta Flow JSON or approved provider assets. */
export type FlowFormDraft={id:string;title:string;screens:{id:string;title:string;fields:{key:string;label:string;type:'text'|'email'|'number';required:boolean}[];next?:string}[]};
const key=/^[a-z][a-z0-9_]{0,31}$/;
export function validateFormDrafts(raw:unknown):asserts raw is FlowFormDraft[]{
 if(!Array.isArray(raw)||raw.length>10)throw Error('Maximum 10 internal form drafts');const ids=new Set();
 for(const f of raw){if(!f||typeof f!=='object'||typeof f.id!=='string'||!key.test(f.id)||ids.has(f.id)||typeof f.title!=='string'||!f.title.trim()||f.title.length>80||!Array.isArray(f.screens)||!f.screens.length||f.screens.length>10)throw Error('Invalid internal form');ids.add(f.id);const screens=new Set(),fields=new Set();
  for(const s of f.screens){if(!s||typeof s.id!=='string'||!key.test(s.id)||screens.has(s.id)||typeof s.title!=='string'||!s.title.trim()||s.title.length>80||!Array.isArray(s.fields)||s.fields.length>10)throw Error('Invalid form screen');screens.add(s.id);
   for(const field of s.fields){if(!field||typeof field.key!=='string'||!key.test(field.key)||fields.has(field.key)||typeof field.label!=='string'||!field.label.trim()||field.label.length>80||!['text','email','number'].includes(field.type)||typeof field.required!=='boolean')throw Error('Invalid form field');fields.add(field.key)}
  }
  // Linear, fully reachable screens. Provider data exchange/actions deliberately absent.
  for(const [i,s]of f.screens.entries())if(s.next!==(f.screens[i+1]?.id))throw Error('Form screens must follow their declared order');
 }
}
