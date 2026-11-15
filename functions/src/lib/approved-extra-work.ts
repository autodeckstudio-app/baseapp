import {createHash} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';
import type {Firestore,Transaction} from 'firebase-admin/firestore';
import type {ServiceJob,ApprovalRequest} from '@autodeck/core';
import {workSnapshotSchema} from './work-snapshot-schema.js';
/** Prepare, but do not write, a new immutable work revision for newly
 * consented extra work. Old performed/QC facts stay exactly as recorded.
 * An earlier work lock must not make newly approved work disappear. */
export async function prepareApprovedExtraWork(tx:Transaction,db:Firestore,job:ServiceJob,approval:ApprovalRequest){
 const fail=()=>{throw new HttpsError('failed-precondition','Work changed. Reload before approving.');};
 const ref=db.collection('jobPerformedWork').doc(job.id),w=await tx.get(ref);
 if(!w.exists)return null;
 const parsed=workSnapshotSchema.safeParse(w.data());if(!parsed.success)return fail();const snap=parsed.data;
 const scope={tenantId:job.tenantId,studioId:job.studioId,jobId:job.id,customerId:job.customerId,vehicleId:job.vehicleId};
 const lines=Array.isArray(job.lines)?job.lines:[{serviceId:job.serviceId,name:(job as ServiceJob&{serviceName?:string}).serviceName??'Service'}];
 if(Object.entries(scope).some(([k,v])=>snap.ledger.scope[k as keyof typeof scope]!==v||approval[k as keyof ApprovalRequest]!==v)||snap.sourceJobHash!==createHash('sha256').update(JSON.stringify(lines)).digest('hex'))return fail();
 const old=workSnapshotSchema.safeParse((await tx.get(ref.collection('revisions').doc(String(snap.ledger.revision)))).data());if(!old.success||JSON.stringify(old.data)!==JSON.stringify(snap))return fail();
 if(snap.ledger.lines.some(l=>l.id===`extra-${approval.id}`||l.approvalId===approval.id))return fail();
 const revision=snap.ledger.revision+1,historyRef=ref.collection('revisions').doc(String(revision));if((await tx.get(historyRef)).exists)return fail();
 const next={...snap,ledger:{...snap.ledger,revision,sealedAt:null,lines:[...snap.ledger.lines,{id:`extra-${approval.id}`,serviceId:approval.serviceId,productId:null,title:approval.serviceName,source:'approved_extra' as const,approvalId:approval.id,approvalStatus:'approved' as const}]}};
 if(!workSnapshotSchema.safeParse(next).success)return fail();
 return{ref,historyRef,snapshot:next};
}
