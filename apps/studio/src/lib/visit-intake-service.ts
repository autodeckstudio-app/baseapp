import {httpsCallable} from 'firebase/functions';
import {parseVisitIntakePage,parseVisitIntakeRead,type VisitIntakeCursor,type VisitIntakeRead} from '@autodeck/core';
import {functions} from './firebase';
export async function readVisitIntakePage(input:{studioId:string}|null,cursor?:VisitIntakeCursor){
 const{data}=await httpsCallable<unknown,unknown>(functions,input?'getStaffWalkinVisitIntakes':'getMyWalkinVisitIntakes',{timeout:15000})({...input,...(cursor?{cursor}:{})});return parseVisitIntakePage(data);
}
export async function prepareVisitIntake(input:{operationId:string;customerId:string;vehicleId:string;studioId:string;serviceIds:string[];notes?:string}){
 const{data}=await httpsCallable<typeof input,unknown>(functions,'prepareWalkinVisitIntake',{timeout:30000})(input);return parseVisitIntakeRead(data);
}
export async function offerVisitIntake(input:{intakeId:string;expectedRevision:number;quoteBases:{lineId:string;basePricePaise:number}[]}){
 const{data}=await httpsCallable<typeof input,unknown>(functions,'offerWalkinVisitIntake',{timeout:30000})(input);return parseVisitIntakeRead(data);
}
export async function respondVisitIntake(i:VisitIntakeRead,decision:'accepted'|'declined'){
 if(i.totalAmount===null)throw new Error('Wait for every item price.');
 const input={intakeId:i.id,expectedRevision:i.revision,expectedTotalPaise:i.totalAmount,lineIds:i.lines.map(l=>l.id),decision};
 const{data}=await httpsCallable<typeof input,unknown>(functions,'respondToWalkinVisitIntake',{timeout:30000})(input);return parseVisitIntakeRead(data);
}
