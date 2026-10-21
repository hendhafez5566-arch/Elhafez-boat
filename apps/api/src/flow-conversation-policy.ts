import {validateBusinessSchedule,type BusinessSchedule} from './flow-time.js';
import {isUuid} from './services.js';
export type HandoffPolicy={strategy:'QUEUE'|'ANY'|'MEMBER'|'TEAM';memberId?:string;team?:string;queue:string;schedule?:BusinessSchedule;unavailableNext:string;resumeNext?:string;idleSeconds?:number;idleAction?:'RESUME'|'CLOSE'|'QUEUE'};
export type BotAction={operation:'PAUSE'|'RESUME'|'STOP';next:string;seconds?:number};
export function validateHandoffPolicy(value:unknown):asserts value is HandoffPolicy{
 const p=value as HandoffPolicy;if(!p||typeof p!=='object'||!['QUEUE','ANY','MEMBER','TEAM'].includes(p.strategy)||typeof p.queue!=='string'||!p.queue.trim()||p.queue.length>80||typeof p.unavailableNext!=='string'||p.unavailableNext.length>180)throw Error('Choose a handoff strategy, named queue and unavailable route');
 if(p.strategy==='MEMBER'&&!isUuid(p.memberId)||p.strategy==='TEAM'&&(typeof p.team!=='string'||!p.team.trim()||p.team.length>80))throw Error('Choose an eligible member or named team');
 if(p.schedule)validateBusinessSchedule(p.schedule);
 if(p.resumeNext!==undefined&&(typeof p.resumeNext!=='string'||p.resumeNext.length>180))throw Error('Invalid handoff resume route');
 if(p.idleSeconds!==undefined&&(!Number.isInteger(p.idleSeconds)||p.idleSeconds<1||p.idleSeconds>604800||!['RESUME','CLOSE','QUEUE'].includes(String(p.idleAction))||p.idleAction==='RESUME'&&!p.resumeNext))throw Error('Handoff inactivity requires 1–604800 seconds and an explicit outcome/resume route');
 if(p.idleAction!==undefined&&p.idleSeconds===undefined)throw Error('Choose the inactivity timeout');
}
