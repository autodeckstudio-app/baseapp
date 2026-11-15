import{VisitReceiptJournal,type VisitReceiptCommand}from'@autodeck/core';
import{submitVisitReceipt}from'./visit-receipt-service';
export function createVisitReceiptJournal(scope:{uid:string;tenantId:string;visitId:string},current:()=>boolean){
 const journal=new VisitReceiptJournal(scope,{getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v),removeItem:async k=>localStorage.removeItem(k)},current);
 const locked=async<T>(run:()=>Promise<T>)=>{if(typeof navigator==='undefined'||!navigator.locks)throw Error('Safe receipt retry is unavailable in this browser.');return navigator.locks.request(journal.key,{mode:'exclusive'},run)};
 return{restore:()=>locked(()=>journal.restore()),prepare:(command:VisitReceiptCommand)=>locked(()=>journal.prepare(command)),send:()=>locked(()=>journal.send(submitVisitReceipt))};
}
