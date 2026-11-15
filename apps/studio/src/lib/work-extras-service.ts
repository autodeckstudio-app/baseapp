// Private options reader. No approval/price/work writes. Existing approvals query.
import{collection,query,where,orderBy,onSnapshot}from'firebase/firestore';
import{db}from'./firebase';import{COLLECTIONS}from'@autodeck/database';
import type{WorkCommandScope}from'@autodeck/core';
import{parseWorkExtras,type WorkExtraOption}from'./work-extras-options';
export type{WorkExtraOption}from'./work-extras-options';
export function listenToWorkExtras(scope:WorkCommandScope,onData:(items:WorkExtraOption[])=>void,onError:()=>void){const q=query(collection(db,COLLECTIONS.approvals()),where('jobId','==',scope.jobId),where('tenantId','==',scope.tenantId),orderBy('createdAt','desc'));return onSnapshot(q,s=>{try{onData(parseWorkExtras(s.docs.map(d=>({id:d.id,data:d.data()})),scope))}catch{onError()}},onError)}
