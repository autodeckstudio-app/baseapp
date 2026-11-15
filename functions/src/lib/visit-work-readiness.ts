import {createHash} from 'node:crypto';
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import {visitWorkReadiness,type VisitWorkReadiness,type VisitExtraWork,type ServiceJob} from '@autodeck/core';
import {workSnapshotSchema} from './work-snapshot-schema.js';
/** Must be called inside the stage transaction, before its first write. No
 * client progress/revision/payment flag can stand in for these exact reads. */
export async function readVisitWorkReadiness(tx:Transaction,db:Firestore,job:ServiceJob):Promise<VisitWorkReadiness|null>{
 const booked=Array.isArray(job.lines)&&job.lines.length?job.lines:[{serviceId:job.serviceId,name:(job as ServiceJob&{serviceName?:string}).serviceName??'Service'}];
 const scope={tenantId:job.tenantId,studioId:job.studioId,jobId:job.id,vehicleId:job.vehicleId,customerId:job.customerId};
 const [work,approvals]=await Promise.all([tx.get(db.collection('jobPerformedWork').doc(job.id)),tx.get(db.collection('approvals').where('jobId','==',job.id).limit(101))]);
 const invalid=():VisitWorkReadiness=>({ready:false,reason:'work_changed',total:booked.length,checked:0});
 if(approvals.size>100)return invalid();
 const extras:VisitExtraWork[]=[];
 for(const d of approvals.docs){const a=d.data();if(a['id']!==d.id||Object.entries(scope).some(([k,v])=>a[k]!==v)||typeof a['serviceId']!=='string'||typeof a['serviceName']!=='string'||typeof a['status']!=='string')return invalid();extras.push({id:d.id,serviceId:a['serviceId'],serviceName:a['serviceName'],status:a['status']});}
 // Preserve untouched single-service legacy visits. Multi-service or recorded
 // visits must establish each line; no backfill pretends old work was checked.
 if(extras.some(a=>!['pending','approved','rejected','expired','cancelled'].includes(a.status)))return invalid();
 if(!work.exists&&booked.length===1&&!extras.some(a=>a.status==='approved'||a.status==='pending'))return null;
 let ledger=null;
 if(work.exists){
  const parsed=workSnapshotSchema.safeParse(work.data());if(!parsed.success)return invalid();const snap=parsed.data;
  if(snap.sourceJobHash!==createHash('sha256').update(JSON.stringify(Array.isArray(job.lines)?job.lines:booked)).digest('hex'))return invalid();
  const history=workSnapshotSchema.safeParse((await tx.get(work.ref.collection('revisions').doc(String(snap.ledger.revision)))).data());if(!history.success||JSON.stringify(history.data)!==JSON.stringify(snap))return invalid();
  ledger={...snap.ledger,facts:snap.ledger.facts.map(({productKind,...fact})=>({...fact,...(productKind!==undefined?{productKind}:{})}))};
 }
 return visitWorkReadiness({scope,booked,extras,ledger});
}
