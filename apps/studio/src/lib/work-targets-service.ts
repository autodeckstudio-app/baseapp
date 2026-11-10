// Private target options reader for work recording. No protection/work
// writes. The existing rules already allow tenant-scoped staff reads of
// vehicle protections; this listener changes no access.
import{collection,query,where,onSnapshot}from'firebase/firestore';
import{db}from'./firebase';import{COLLECTIONS}from'@autodeck/database';
import type{WorkCommandScope}from'@autodeck/core';
import{parseWorkTargets,type WorkTargetOption}from'./work-targets-options';
export type{WorkTargetOption}from'./work-targets-options';
export function listenToWorkTargets(scope:WorkCommandScope,onData:(items:WorkTargetOption[])=>void,onError:()=>void){const q=query(collection(db,COLLECTIONS.vehicles(),scope.vehicleId,'protections'),where('tenantId','==',scope.tenantId));return onSnapshot(q,s=>{try{onData(parseWorkTargets(s.docs.map(d=>({id:d.id,data:d.data()})),scope))}catch{onError()}},onError)}
