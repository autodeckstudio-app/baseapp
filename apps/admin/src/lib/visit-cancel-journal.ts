import{VisitCancelJournal,type VisitCancelCommand}from'@autodeck/core';
import{submitVisitCancellation}from'./visit-cancel-service';
export function createVisitCancelJournal(scope:{uid:string;tenantId:string;visitId:string},current:()=>boolean){
 const journal=new VisitCancelJournal(scope,{getItem:async k=>localStorage.getItem(k),setItem:async(k,v)=>localStorage.setItem(k,v),removeItem:async k=>localStorage.removeItem(k)},current);
 const locked=async<T>(run:()=>Promise<T>)=>{if(typeof navigator==='undefined'||!navigator.locks)throw Error('Safe cancellation retry is unavailable in this browser.');return navigator.locks.request(journal.key,{mode:'exclusive'},run)};
 return{restore:()=>locked(()=>journal.restore()),prepare:(command:VisitCancelCommand)=>locked(()=>journal.prepare(command)),send:()=>locked(()=>journal.send(submitVisitCancellation))};
}
