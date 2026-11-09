export type CombinedReturnEntry={key:string;paymentId:string|null;method:string;capturedPaise:number;retainedPaise:number;returnPaise:number;returnedPaise:number;requestId:string|null};
export type CombinedReturnReview={reviewToken:string|null;plan:null|{version:2;status:'awaiting_admin'|'approved'|'returned';paidPaise:number;feePaise:number;refundPaise:number;entries:CombinedReturnEntry[]}};
async function call<T>(name:string,data:unknown):Promise<T>{const{httpsCallable}=await import('firebase/functions');const{functions}=await import('./firebase');return(await httpsCallable<unknown,T>(functions,name)(data)).data;}
export const getCombinedReturnReview=(bookingId:string)=>call<CombinedReturnReview>('getCombinedReturnReview',{bookingId});
export const approveCombinedReturn=(bookingId:string,reviewToken:string)=>call('approveCombinedReturn',{bookingId,reviewToken,approved:true});
export const settleCombinedManualReturn=(bookingId:string,entryKey:string,reviewToken:string,note:string)=>call('settleCombinedManualReturn',{bookingId,entryKey,reviewToken,returned:true,note});
