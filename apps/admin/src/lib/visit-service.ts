import{parseVisitScheduleReview,type VisitScheduleCommand}from'@autodeck/core';
import {httpsCallable} from 'firebase/functions';
import {parseVisitBayOptions,parseVisitRead,type VisitBayOptions,type VisitRead} from '@autodeck/core';
import {functions} from './firebase';
export async function getVisit(jobId:string,self=false):Promise<VisitRead>{
 const{data}=await httpsCallable<{jobId:string},unknown>(functions,self?'getMyVisit':'getStaffVisit',{timeout:15000})({jobId});
 return parseVisitRead(data,jobId,self);
}

export type HandoverReview={visitId:string;expectedRevision:number;operationId:string;confirmed:true;members:{jobId:string;expectedUpdatedAt:string;recordedWork:{revision:number;hash:string}|null}[];review?:{priorManifestId:string;members:{jobId:string;expectedUpdatedAt:string;recordedWork:{revision:number;hash:string}|null}[]}};
export async function startVisitHandover(input:HandoverReview){
 const{data}=await httpsCallable<HandoverReview,{manifestId:string;alreadyStarted:boolean}>(functions,'startVisitHandover',{timeout:30000})(input);
 if(!data||typeof data.manifestId!=='string'||!data.manifestId.startsWith('handover_'))throw new Error('Handover could not be verified. Reload.');return data;
}

export async function completeVisitHandover(manifestId:string){
 const{data}=await httpsCallable<{manifestId:string;confirmed:true},{manifestId:string;status:'complete'|'incomplete';error:string|null}>(functions,'completeVisitHandover',{timeout:120000})({manifestId,confirmed:true});
 if(!data||data.manifestId!==manifestId||!['complete','incomplete'].includes(data.status))throw new Error('Handover could not be verified. Reload.');
 return data;
}

export type JoinOptions={jobId:string;expectedUpdatedAt?:string;existingVisit?:{visitId:string;expectedRevision:number};members?:{jobId:string;expectedUpdatedAt:string;service:string;status:string;scheduledDate:string}[];options:{jobId:string;expectedUpdatedAt:string;service:string;status:string;scheduledDate:string}[];bounded:boolean};
export async function getVisitJoinOptions(jobId:string):Promise<JoinOptions>{
 const{data}=await httpsCallable<{jobId:string},JoinOptions>(functions,'getVisitJoinOptions',{timeout:15000})({jobId});
 if(!data||data.jobId!==jobId||data.existingVisit&&(!data.members?.length||data.existingVisit.visitId.length<1||!Number.isSafeInteger(data.existingVisit.expectedRevision)||data.existingVisit.expectedRevision<1)||data.members&&(!data.members.length||data.members.length>20||new Set(data.members.map(m=>m.jobId)).size!==data.members.length||data.members.some(m=>typeof m.jobId!=='string'||typeof m.expectedUpdatedAt!=='string'||typeof m.service!=='string'))||!Array.isArray(data.options)||data.options.length>19||typeof data.bounded!=='boolean'||data.options.some(o=>!o||typeof o.jobId!=='string'||typeof o.expectedUpdatedAt!=='string'||typeof o.service!=='string'||typeof o.status!=='string'||typeof o.scheduledDate!=='string'))throw new Error('Visit options unavailable.');return data;
}
export async function joinVisit(input:{operationId:string;confirmed:true;existingVisit?:{visitId:string;expectedRevision:number};members:{jobId:string;expectedUpdatedAt:string}[]}){
 const{data}=await httpsCallable<typeof input,{visitId:string;alreadyJoined:boolean}>(functions,'joinVisit',{timeout:30000})(input);if(!data||typeof data.visitId!=='string')throw new Error('Join could not be verified. Reload the job.');return data;
}

export async function getVisitBayOptions(jobId:string){const{data}=await httpsCallable<{jobId:string},unknown>(functions,'getVisitBayOptions',{timeout:15000})({jobId});return parseVisitBayOptions(data,jobId)}
export type VisitBayCommand={jobId:string;visitId:string;expectedRevision:number;members:{jobId:string;expectedUpdatedAt:string}[];pauseJobIds:string[];vacatedBayIds?:string[];targetBayId:string;confirmed:true;operationId:string};
export async function moveVisitBay(input:VisitBayCommand){const{data}=await httpsCallable<VisitBayCommand,{visitId:string;revision:number;alreadyMoved:boolean}>(functions,'moveVisitBay',{timeout:30000})(input);if(!data||data.visitId!==input.visitId||!Number.isSafeInteger(data.revision)||data.revision<=input.expectedRevision||typeof data.alreadyMoved!=='boolean')throw Error('Car move not confirmed. Refresh the visit.');return data;}

export async function releaseVisitBay(input:{jobId:string;visitId:string;expectedRevision:number;members:{jobId:string;expectedUpdatedAt:string}[];confirmWorkCompleteAndBayEmpty:true;operationId:string}){const{data}=await httpsCallable<typeof input,{visitId:string;revision:number;alreadyReleased:boolean}>(functions,'releaseVisitBay',{timeout:30000})(input);if(!data||data.visitId!==input.visitId||!Number.isSafeInteger(data.revision)||data.revision<=input.expectedRevision||typeof data.alreadyReleased!=='boolean')throw Error('Bay release not confirmed. Refresh the visit.');return data;}

export async function getVisitScheduleReview(jobId:string){const{data}=await httpsCallable<{jobId:string},unknown>(functions,'getVisitScheduleReview',{timeout:15000})({jobId});return parseVisitScheduleReview(data,jobId)}
export async function rescheduleVisit(input:VisitScheduleCommand){const{data}=await httpsCallable<VisitScheduleCommand,{visitId:string;revision:number;alreadyMoved:boolean}>(functions,'rescheduleVisit',{timeout:30000})(input);if(!data||data.visitId!==input.visitId||!Number.isSafeInteger(data.revision)||data.revision<=input.expectedRevision||typeof data.alreadyMoved!=='boolean')throw Error('Visit move not confirmed. Review the schedule.');return data;}

export async function getVisitBill(view:VisitRead){
 const {parseVisitBillRead}=await import('@autodeck/core');
 if(view.status!=='grouped')throw Error('Choose a shared visit.');
 const{data}=await httpsCallable<{visitId:string},unknown>(functions,'getStaffVisitBill',{timeout:15000})({visitId:view.visitId});
 return parseVisitBillRead(data,view);
}
