import{httpsCallable}from'firebase/functions';
import{allocateVisitReceipt,parseVisitBillRead,parseVisitReceiptOutcome,type VisitRead,type VisitReceiptCommand}from'@autodeck/core';
import{functions}from'./firebase';
export async function reviewVisitReceipt(view:VisitRead,receivedPaise:number){
 if(view.status!=='grouped')throw Error('Visit unavailable.');
 const{data}=await httpsCallable<{visitId:string;receiptPaise:number},unknown>(functions,'getStaffVisitBill',{timeout:15000})({visitId:view.visitId,receiptPaise:receivedPaise});
 const bill=parseVisitBillRead(data,view),allocation=allocateVisitReceipt(bill,receivedPaise),raw=data as{allocation?:unknown};
 if(JSON.stringify(raw.allocation)!==JSON.stringify(allocation)||allocation.unappliedPaise)throw Error('Receipt allocation needs office review.');
 return{bill,allocation};
}
export async function prepareReceiptBill(input:{visitId:string;reviewToken:string;operationId:string;confirmed:true}){
 const{data}=await httpsCallable<typeof input,{billId:string;alreadyPrepared:boolean}>(functions,'prepareVisitBill',{timeout:30000})(input);
 if(!data||typeof data.billId!=='string'||!/^bill_[a-f0-9]{64}$/.test(data.billId)||typeof data.alreadyPrepared!=='boolean')throw Error('Bill preparation needs checking. No receipt submitted.');return data;
}
export async function submitVisitReceipt(command:VisitReceiptCommand){
 const{data}=await httpsCallable<VisitReceiptCommand,unknown>(functions,'recordVisitReceipt',{timeout:30000})(command);return parseVisitReceiptOutcome(data,command);
}
