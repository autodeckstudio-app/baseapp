import{createHash}from'node:crypto';import type{Transaction,Firestore}from'firebase-admin/firestore';import{HttpsError}from'firebase-functions/v2/https';import{recordedWorkHandover,type WorkLedger,type ServiceJob}from'@autodeck/core';import{workSnapshotSchema}from'../functions/work/getJobWorkCoverage.js';
/** Called inside the delivery transaction. A client revision is a selector,
 * never authority for work, owner, target, price or warranty data. */
export async function readRecordedHandover(tx:Transaction,db:Firestore,job:ServiceJob,revision:number){
 const fail=()=>{throw new HttpsError('failed-precondition','Recorded work changed or needs review. Reload work before delivering.')};
 const ref=db.collection('jobPerformedWork').doc(job.id);const raw=(await tx.get(ref)).data();const parsed=workSnapshotSchema.safeParse(raw);if(!parsed.success)return fail();const snap=parsed.data;
 const lines=Array.isArray(job.lines)?job.lines:[{serviceId:job.serviceId,name:(job as unknown as {serviceName?:string}).serviceName??'Service'}];
 if(snap.ledger.revision!==revision||snap.sourceJobHash!==createHash('sha256').update(JSON.stringify(lines)).digest('hex'))return fail();
 const history=workSnapshotSchema.safeParse((await tx.get(ref.collection('revisions').doc(String(revision)))).data());if(!history.success||JSON.stringify(history.data)!==JSON.stringify(snap))return fail();
 const booked=snap.ledger.lines.filter(l=>l.source==='booked');if(booked.length!==lines.length||booked.some(l=>{const index=Number(l.id.replace(/^booked-/,''));return!Number.isInteger(index)||l.id!==`booked-${index}`||!lines[index]||l.serviceId!==lines[index]!.serviceId||l.title!==lines[index]!.name}))return fail();
 for(const line of snap.ledger.lines.filter(l=>l.source==='approved_extra')){if(!line.approvalId)return fail();const a=(await tx.get(db.collection('approvals').doc(line.approvalId))).data();if(!a||a['id']!==line.approvalId||a['status']!=='approved'||a['serviceId']!==line.serviceId||a['jobId']!==job.id||a['tenantId']!==job.tenantId||a['studioId']!==job.studioId||a['customerId']!==job.customerId||a['vehicleId']!==job.vehicleId)return fail()}
 const events=recordedWorkHandover(snap.ledger as WorkLedger,{jobId:job.id,tenantId:job.tenantId,studioId:job.studioId,customerId:job.customerId,vehicleId:job.vehicleId});if(events===null)return fail();return events;
}
