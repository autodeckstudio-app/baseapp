import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {VisitReceiptJournal,type VisitReceiptCommand} from '@autodeck/core';
import {submitVisitReceipt} from './visit-receipt-service';
const queues=new Map<string,Promise<unknown>>();
export function createVisitReceiptJournal(scope:{uid:string;tenantId:string;visitId:string},current:()=>boolean){
 const journal=new VisitReceiptJournal(scope,AsyncStorage,current);
 function locked<T>(run:()=>Promise<T>):Promise<T>{
  if(Platform.OS==='web'){
   const locks=typeof navigator==='undefined'?undefined:(navigator as unknown as {locks?:{request<R>(key:string,options:{mode:'exclusive'},fn:()=>Promise<R>):Promise<R>}}).locks;
   if(!locks)throw Error('Safe receipt retry is unavailable in this browser.');
   return locks.request(journal.key,{mode:'exclusive'},run);
  }
  const previous=queues.get(journal.key)??Promise.resolve();
  const next=previous.catch(()=>undefined).then(run);queues.set(journal.key,next);
  void next.finally(()=>{if(queues.get(journal.key)===next)queues.delete(journal.key)}).catch(()=>undefined);
  return next;
 }
 const cash=(c:VisitReceiptCommand)=>{if(c.method!=='cash')throw Error('Office account receipt needs office review.');return c};
 return{restore:()=>locked(async()=>{const c=await journal.restore();return c?cash(c):null}),prepare:(command:VisitReceiptCommand)=>locked(()=>journal.prepare(cash(command))),send:()=>locked(()=>journal.send(c=>submitVisitReceipt(cash(c))))};
}
