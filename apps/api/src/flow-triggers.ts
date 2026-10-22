/** Shared trigger matching/conflict rules. No provider calls or customer values retained. */
import type {DraftTrigger,FlowChannel} from './flow-engine.js';
import {normalizeQuestion} from './knowledge.js';
export const triggerEvents=['MESSAGE','POSTBACK','MEDIA','LOCATION'] as const;
export type TriggerEvent=typeof triggerEvents[number];
export type TriggerContext={channel?:FlowChannel;event?:TriggerEvent};
export function triggerMatches(t:DraftTrigger,body:string,first:boolean,ctx:TriggerContext={}):boolean{
 if(!t.enabled||t.channel&&t.channel!==ctx.channel)return false;
 if(t.kind==='FIRST_MESSAGE')return first;
 if(t.kind==='EVENT')return t.phrase===(ctx.event||'MESSAGE');
 // A button title/media placeholder must never masquerade as customer keyword text.
 if(ctx.event&&ctx.event!=='MESSAGE')return false;
 const phrase=normalizeQuestion(t.phrase),q=normalizeQuestion(body);
 return Boolean(phrase)&&(t.matchMode==='EXACT'?q===phrase:q.includes(phrase));
}
export function triggersOverlap(a:DraftTrigger,b:DraftTrigger):boolean{
 if(!a.enabled||!b.enabled||a.channel&&b.channel&&a.channel!==b.channel)return false;
 if(a.kind==='FIRST_MESSAGE'||b.kind==='FIRST_MESSAGE')return true;
 if(a.kind==='EVENT'||b.kind==='EVENT')return a.kind==='EVENT'&&b.kind==='EVENT'?a.phrase===b.phrase:(a.kind==='EVENT'?a:b).phrase==='MESSAGE';
 const x=normalizeQuestion(a.phrase),y=normalizeQuestion(b.phrase);
 if(a.matchMode==='EXACT'&&b.matchMode==='EXACT')return x===y;
 if(a.matchMode==='EXACT')return x.includes(y);
 if(b.matchMode==='EXACT')return y.includes(x);
 return true; // A message can contain both phrases, even if neither contains the other.
}
export function triggerConflicts(triggers:DraftTrigger[]):{first:number;second:number;priority:number}[]{
 const result=[];for(let i=0;i<triggers.length;i++)for(let j=i+1;j<triggers.length;j++)if(triggers[i].priority===triggers[j].priority&&triggers[i].targetNode!==triggers[j].targetNode&&triggersOverlap(triggers[i],triggers[j]))result.push({first:i,second:j,priority:triggers[i].priority});return result;
}
/** Only a callback available on the pinned waiting node is a triggerable postback. */
export function validTriggerPostback(flow:import('./flow-engine.js').FlowDefinition,nodeId:string|null,action:string,runtime?:import('./flow-engine.js').FlowRuntime):boolean{
 const node=flow.nodes.find(n=>n.id===nodeId);if(!node)return false;
 if(node.type==='BUTTONS'||node.type==='LIST')return node.choices.some(c=>c.action!=='URL'&&action===`flow:${node.id}:${c.id}`);
 if(node.type==='INPUT')return Boolean(node.policy?.skipNext&&action===`flow:${node.id}:skip`);
 if(node.type==='CONSENT')return Boolean(runtime?.consent?.nodeId===node.id&&runtime.consent.policyVersion===node.policyVersion&&['accept','decline',...(node.withdrawNext?['withdraw']:[])].some(decision=>action===`consent:${runtime.consent!.token}:${decision}`));
 return false;
}
