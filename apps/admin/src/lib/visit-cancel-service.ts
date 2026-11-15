import{httpsCallable}from'firebase/functions';
import{parseVisitBillRead,parseVisitCancelResult,type VisitRead,type VisitCancelCommand}from'@autodeck/core';
import{functions}from'./firebase';
export async function reviewVisitCancellation(view:VisitRead,jobId:string){
 if(view.status!=='grouped'||!view.members.some(m=>m.jobId===jobId))throw Error('Visit service unavailable.');
 const{data}=await httpsCallable<{visitId:string;cancelJobId:string},unknown>(functions,'getStaffVisitBill',{timeout:15000})({visitId:view.visitId,cancelJobId:jobId});const bill=parseVisitBillRead(data,view),c=(data as any)?.cancellation;
 if(!c||c.visitId!==view.visitId||c.revision!==view.revision||!Number.isSafeInteger(c.feePaise)||c.feePaise<0||!['another_service_continues','last_service_policy'].includes(c.reason)||!Array.isArray(c.continuingJobIds)||c.continuingJobIds.length!==view.members.filter(m=>m.jobId!==jobId&&m.status!=='CANCELLED').length||new Set(c.continuingJobIds).size!==c.continuingJobIds.length||c.continuingJobIds.some((id:unknown)=>typeof id!=='string'||id===jobId||!view.members.some(m=>m.jobId===id&&m.status!=='CANCELLED'))||!(c.hold===null||typeof c.hold==='string')||c.reason==='another_service_continues'&&(c.feePaise!==0||!c.continuingJobIds.length)||c.reason==='last_service_policy'&&c.continuingJobIds.length)throw Error('Cancellation review changed.');
 return{bill,cancellation:{feePaise:c.feePaise as number,reason:c.reason as'last_service_policy'|'another_service_continues',continuingJobIds:c.continuingJobIds as string[],hold:c.hold as string|null}};
}
export async function submitVisitCancellation(c:VisitCancelCommand){const{data}=await httpsCallable<VisitCancelCommand,unknown>(functions,'cancelVisitService',{timeout:30000})(c);return parseVisitCancelResult(data,c);}
