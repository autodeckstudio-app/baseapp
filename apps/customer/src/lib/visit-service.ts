import {httpsCallable} from 'firebase/functions';
import {parseVisitRead,type VisitRead} from '@autodeck/core';
import {functions} from './firebase';
export async function getVisit(jobId:string,self=false):Promise<VisitRead>{
 const{data}=await httpsCallable<{jobId:string},unknown>(functions,self?'getMyVisit':'getStaffVisit',{timeout:15000})({jobId});
 return parseVisitRead(data,jobId,self);
}

export async function getVisitBill(view:VisitRead){
 const {parseVisitBillRead}=await import('@autodeck/core');
 if(view.status!=='grouped')throw Error('Choose a shared visit.');
 const{data}=await httpsCallable<{visitId:string},unknown>(functions,'getMyVisitBill',{timeout:15000})({visitId:view.visitId});
 return parseVisitBillRead(data,view);
}
