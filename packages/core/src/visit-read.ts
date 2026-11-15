import type {JobStatus} from './types/job';
import {visitServiceLabel,type SharedVisitState} from './shared-visit';
export type VisitReadMember={jobId:string;workPaused?:boolean;bookingId:string|null;updatedAt?:string;recordedWork?:{revision:number;hash:string}|null;history:{status:JobStatus;changedAt:string}[];status:JobStatus;serviceStatus:string;lines:{serviceId:string;name:string}[];totalAmount:number|null;paymentStatus:string};
export type VisitRead={status:'ungrouped';jobId:string}|{status:'grouped';jobId:string;visitId:string;revision:number;state:SharedVisitState;transportJobId:string|null;bill:{totalAmount:number|null;items:{jobId:string;totalAmount:number|null;paymentStatus:string;cancelled:boolean}[]};members:VisitReadMember[];handover:{manifestId:string;status:'pending'|'incomplete'|'complete';outcomes:Record<string,{status:'delivered';at:string;by?:string}>;expected?:Record<string,{updatedAt:string;recordedWorkRevision:number;recordedWorkHash:string}>}|null};
const statuses=['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY','DELIVERED','CANCELLED'];
const record=(v:unknown):v is Record<string,any>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const money=(v:unknown)=>v===null||typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const work=(v:any)=>record(v)&&Number.isSafeInteger(v.revision)&&v.revision>0&&typeof v.hash==='string'&&/^[a-f0-9]{64}$/.test(v.hash);
const text=(v:unknown)=>typeof v==='string'&&v.length>0;
/** Reject partial, duplicated and mismatched views rather than interpreting an
 * unreadable visit as a single ready service. Staff fields never cross self. */
export function parseVisitRead(raw:unknown,jobId:string,self:boolean):VisitRead{
 const fail=():never=>{throw new Error('Visit unavailable. Reload.');};
 if(!record(raw)||raw.jobId!==jobId)return fail();
 if(raw.status==='ungrouped')return{status:'ungrouped',jobId};
 if(raw.status!=='grouped'||!text(raw.visitId)||!Number.isSafeInteger(raw.revision)||raw.revision<1||!['expected','working','ready','handover_incomplete','delivered','cancelled'].includes(raw.state)||!Array.isArray(raw.members)||!raw.members.length||raw.members.length>20)return fail();
 const members:VisitReadMember[]=raw.members.map((m:unknown)=>{
  if(!record(m)||m.workPaused!==undefined&&typeof m.workPaused!=='boolean'||!text(m.jobId)||!(m.bookingId===null||text(m.bookingId))||!statuses.includes(m.status)||!(m.workPaused===true&&['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK'].includes(m.status)&&m.serviceStatus==='Work paused'||m.serviceStatus===visitServiceLabel(m.status)&&m.workPaused!==true||m.workPaused!==true&&m.status==='READY_FOR_DELIVERY'&&m.serviceStatus==='Check work')||!money(m.totalAmount)||!['unpaid','partial','paid','refunded'].includes(m.paymentStatus)||!Array.isArray(m.lines)||!m.lines.length||m.lines.length>100||m.lines.some((l:unknown)=>!record(l)||!text(l.serviceId)||!text(l.name))||!Array.isArray(m.history)||m.history.length>1000||m.history.some((h:unknown)=>!record(h)||!statuses.includes(h.status)||!text(h.changedAt)||!Number.isFinite(Date.parse(h.changedAt)))||!self&&(!text(m.updatedAt)||!(m.recordedWork===null||work(m.recordedWork))))return fail();
  return{jobId:m.jobId,...(m.workPaused===true?{workPaused:true}:{}),bookingId:m.bookingId,history:m.history.map((h:any)=>({status:h.status,changedAt:h.changedAt})),status:m.status,serviceStatus:m.serviceStatus,lines:m.lines.map((l:any)=>({serviceId:l.serviceId,name:l.name})),totalAmount:m.totalAmount,paymentStatus:m.paymentStatus,...(!self?{updatedAt:m.updatedAt,recordedWork:m.recordedWork?{revision:m.recordedWork.revision,hash:m.recordedWork.hash}:null}:{})};
 });
 const ids=members.map(m=>m.jobId);
 if(new Set(ids).size!==ids.length||!ids.includes(jobId)||!(raw.transportJobId===null||ids.includes(raw.transportJobId))||!record(raw.bill)||!money(raw.bill.totalAmount)||!Array.isArray(raw.bill.items)||raw.bill.items.length!==ids.length)return fail();
 const items=raw.bill.items.map((b:unknown)=>{if(!record(b))return fail();const m=members.find(mEntry23=>mEntry23.jobId===b.jobId);if(!m||b.totalAmount!==m.totalAmount||b.paymentStatus!==m.paymentStatus||b.cancelled!==(m.status==='CANCELLED'))return fail();return{jobId:m.jobId,totalAmount:m.totalAmount,paymentStatus:m.paymentStatus,cancelled:b.cancelled};});
 if(new Set(items.map(i=>i.jobId)).size!==ids.length)return fail();
 const active=members.filter(m=>m.status!=='CANCELLED'),known=active.every(m=>m.totalAmount!==null),sum=known?active.reduce((n,m)=>n+(m.totalAmount??NaN),0):null;
 if(raw.bill.totalAmount!==(sum!==null&&Number.isSafeInteger(sum)?sum:null))return fail();
 if(raw.state==='ready'&&(!active.length||active.some(m=>m.status!=='READY_FOR_DELIVERY'||m.totalAmount===null||m.serviceStatus==='Check work'))||raw.state==='delivered'&&(!active.length||active.some(m=>m.status!=='DELIVERED'))||raw.state==='cancelled'&&active.length||raw.state==='expected'&&active.some(m=>m.status!=='PENDING_VEHICLE'))return fail();
 let handover:Extract<VisitRead,{status:'grouped'}>['handover']=null;
 if(raw.handover!==null){const h=raw.handover;if(!record(h)||!text(h.manifestId)||!['pending','incomplete','complete'].includes(h.status)||!record(h.outcomes)||Object.keys(h.outcomes).some(id=>!ids.includes(id)))return fail();const outcomes:Record<string,{status:'delivered';at:string;by?:string}>={};
  for(const[id,v]of Object.entries(h.outcomes)){if(!record(v)||v.status!=='delivered'||!text(v.at)||!Number.isFinite(Date.parse(v.at))||members.find(m=>m.jobId===id)?.status!=='DELIVERED')return fail();outcomes[id]={status:'delivered',at:v.at,...(!self&&text(v.by)?{by:v.by}:{})};}
  if(!self&&(!record(h.expected)||Object.keys(h.expected).some(id=>!ids.includes(id)||!record(h.expected[id])||!text(h.expected[id].updatedAt)||!Number.isSafeInteger(h.expected[id].recordedWorkRevision)||h.expected[id].recordedWorkRevision<1||typeof h.expected[id].recordedWorkHash!=='string'||!/^[a-f0-9]{64}$/.test(h.expected[id].recordedWorkHash))))return fail();
  handover={manifestId:h.manifestId,status:h.status,outcomes,...(!self?{expected:h.expected}:{})};
 }
 return{status:'grouped',jobId,visitId:raw.visitId,revision:raw.revision,state:raw.state,transportJobId:raw.transportJobId,bill:{totalAmount:raw.bill.totalAmount,items},members,handover};
}
export const sharedVisitLabel=(state:SharedVisitState)=>({expected:'Awaiting car',working:'In progress',ready:'Ready for collection',handover_incomplete:'Handover incomplete',delivered:'Delivered',cancelled:'Cancelled',needs_review:'Visit needs review'})[state];
