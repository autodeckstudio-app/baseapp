// Combined integration candidate, not deployed. Writes only new work
// ledger + scoped receipt + audit. Never writes job/delivery/protection/
// warranty/stock: targeted lifecycle work (replace/remove) only READS the
// exact Protection record and binds it into the ledger's immutable revision
// history; Protection lifecycle effects stay with the delivery path.
import{onCall,HttpsError}from'firebase-functions/v2/https';import{getFirestore}from'firebase-admin/firestore';import{createHash}from'node:crypto';import{z}from'zod';import{extractUser,assertRole}from'../../middleware/auth.js';import{shouldEnforceAppCheck}from'../../lib/environment.js';import{workSnapshotSchema}from'./getJobWorkCoverage.js';import{writeAuditLog}from'../../middleware/audit.js';import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';import{reviewPerformedWork,protectionLifecycleTarget,type LifecycleTarget,type WorkLedger,type WorkFact}from'@autodeck/core';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);const product=z.object({id,label:z.string().trim().min(1).max(300),kind:z.string().trim().min(1).max(80),coverage:z.string().trim().min(1).max(300)}).strict();
const base={jobId:id,operationId:z.string().uuid(),expectedRevision:z.number().int().min(0)};
// Exact target identity: the Protection document id plus the revision the
// staff member reviewed (a legacy unversioned record is the explicit 0).
const targetFields={targetId:id,targetRevision:z.number().int().min(0)};
const workInput=z.discriminatedUnion('kind',[z.object({kind:z.literal('service')}).strict(),z.object({kind:z.literal('install'),product}).strict(),z.object({kind:z.literal('replace'),product,...targetFields}).strict(),z.object({kind:z.literal('remove'),...targetFields}).strict()]);
const input=z.discriminatedUnion('action',[z.object({...base,action:z.literal('record'),lineId:id,approvalId:id.nullable(),performed:z.literal(true),work:workInput}).strict(),z.object({...base,action:z.literal('qc'),lineId:id,checked:z.literal(true)}).strict(),z.object({...base,action:z.literal('seal'),confirmed:z.literal(true)}).strict()]);
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');const conflict=()=>new HttpsError('failed-precondition','Work changed. Reload before recording.');
export const recordJobPerformedWork=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const parsed=input.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Check the work record.');const data=parsed.data;if(data.action==='seal')assertRole(user,'admin','superadmin');await enforceRateLimit(subjectFrom(user),'work.record');const db=getFirestore();const jobRef=db.collection('jobs').doc(data.jobId),workRef=db.collection('jobPerformedWork').doc(data.jobId);const receiptRef=db.collection('workRecordReceipts').doc(hash([user.claims.tenantId,user.uid,data.jobId,data.operationId].join('|')));const payloadHash=hash(JSON.stringify(data));
 return db.runTransaction(async tx=>{
  const[j,r,w]=await Promise.all([tx.get(jobRef),tx.get(receiptRef),tx.get(workRef)]);const job=j.data();
  if(!job||job['id']!==j.id||job['tenantId']!==user.claims.tenantId||typeof job['vehicleId']!=='string'||typeof job['customerId']!=='string'||typeof job['studioId']!=='string'||user.claims.role==='studio'&&job['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');
  const v=await tx.get(db.collection('vehicles').doc(job['vehicleId']));const car=v.data();if(!car||car['id']!==v.id||car['tenantId']!==user.claims.tenantId||car['deletedAt']||car['ownerId']!==job['customerId'])throw conflict();
  const c=await tx.get(db.collection('customers').doc(job['customerId']));const customer=c.data();if(!customer||customer['id']!==c.id||customer['tenantId']!==user.claims.tenantId||customer['deletedAt'])throw conflict();
  if(r.exists){const receipt=r.data()!;if(receipt['payloadHash']!==payloadHash)throw new HttpsError('already-exists','This operation was used for different work.');return{jobId:j.id,operationId:data.operationId,committedRevision:receipt['revision'],alreadyRecorded:true};}
  if(job['bookingId']){
   const booking=(await tx.get(db.collection('bookings').doc(job['bookingId']))).data();
   if(!booking||booking['tenantId']!==job['tenantId']||booking['customerId']!==job['customerId']||booking['vehicleId']!==job['vehicleId']||booking['studioId']!==job['studioId']||['CANCELLED','EXPIRED'].includes(booking['status'])||((booking['priceOnRequest']===true||booking['requiresPriceApproval']===true)&&booking['quoteStatus']!=='approved'))throw new HttpsError('failed-precondition','The linked booking or customer price approval needs review before recording work.');
  }
  if(!['IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY'].includes(job['status'])||job['sealedAt'])throw new HttpsError('failed-precondition','This visit is not open for work records.');
  const rawLines=Array.isArray(job['lines'])?job['lines']:[{serviceId:job['serviceId'],name:job['serviceName']??'Service'}];if(rawLines.length<1||rawLines.length>100||rawLines.some((line:any)=>!id.safeParse(line?.serviceId).success||typeof line?.name!=='string'||!line.name.trim()||line.name.length>300))throw conflict();
  const sourceJobHash=hash(JSON.stringify(rawLines));const scope={tenantId:user.claims.tenantId,studioId:job['studioId']as string,jobId:j.id,vehicleId:job['vehicleId']as string,customerId:job['customerId']as string};
  const existing=w.exists?workSnapshotSchema.safeParse(w.data()):null;if(existing&&!existing.success)throw conflict();
  const snap=existing?.success?existing.data:null;if(snap&&(snap.sourceJobHash!==sourceJobHash||Object.entries(scope).some(([k,value])=>snap.ledger.scope[k as keyof typeof scope]!==value)||snap.ledger.sealedAt))throw conflict();
  if((snap?.ledger.revision??0)!==data.expectedRevision)throw conflict();if(snap){const previous=workSnapshotSchema.safeParse((await tx.get(workRef.collection('revisions').doc(String(snap.ledger.revision)))).data());if(!previous.success||JSON.stringify(previous.data)!==JSON.stringify(snap))throw conflict();}
  // Every current Protection record on this car, read fresh inside the
  // transaction, supplies the exact lifecycle targets. A record whose stored
  // identity disagrees with its document id is a corrupt binding - excluded,
  // never repaired here.
  const protSnap=await tx.get(db.collection('vehicles').doc(scope.vehicleId).collection('protections'));const targets:LifecycleTarget[]=[];for(const d of protSnap.docs){const p=d.data();if(p['id']!==undefined&&p['id']!==d.id)continue;if(typeof p['tenantId']!=='string'||typeof p['vehicleId']!=='string'||typeof p['customerId']!=='string'||typeof p['kind']!=='string')continue;targets.push(protectionLifecycleTarget({id:d.id,tenantId:p['tenantId'],vehicleId:p['vehicleId'],customerId:p['customerId'],kind:p['kind'],provider:p['provider']??null,coverage:p['coverage']??null,lifecycle:p['lifecycle']??null,revision:p['revision']??null,installedByJobId:p['installedByJobId']??null},scope.studioId));}
  const ledger:WorkLedger=snap?structuredClone(snap.ledger)as WorkLedger:{scope,revision:0,sealedAt:null,lines:rawLines.map((line:any,index:number)=>({id:`booked-${index}`,serviceId:line.serviceId,productId:null,title:line.name,source:'booked',approvalId:null,approvalStatus:null})),facts:[]};
  if(new Set(ledger.lines.map(line=>line.id)).size!==ledger.lines.length||new Set(ledger.facts.map(f=>f.lineId)).size!==ledger.facts.length||ledger.facts.some(f=>!ledger.lines.some(line=>line.id===f.lineId)))throw conflict();for(const line of ledger.lines){if(line.source==='booked'){const index=Number(line.id.replace(/^booked-/,''));const raw=rawLines[index];if(!Number.isInteger(index)||line.id!==`booked-${index}`||!raw||line.serviceId!==raw.serviceId||line.title!==raw.name||line.approvalId!==null||line.approvalStatus!==null)throw conflict();}}if(ledger.lines.filter(line=>line.source==='booked').length!==rawLines.length)throw conflict();const products={...(snap?.products??{})};const evidence=[...(snap?.evidence??[])];
  if(data.action==='record'&&data.approvalId){const a=await tx.get(db.collection('approvals').doc(data.approvalId));const approval=a.data();if(!approval||approval['id']!==a.id||approval['status']!=='approved'||['tenantId','studioId','jobId','customerId','vehicleId'].some(k=>approval[k]!==scope[k as keyof typeof scope])||!id.safeParse(approval['serviceId']).success||typeof approval['serviceName']!=='string'||!approval['serviceName'].trim()||data.lineId!==`extra-${a.id}`)throw conflict();const present=ledger.lines.find(candidate=>candidate.id===data.lineId);if(present&&(present.serviceId!==approval['serviceId']||present.approvalId!==a.id))throw conflict();if(!present)ledger.lines.push({id:data.lineId,serviceId:approval['serviceId'],productId:null,title:approval['serviceName'],source:'approved_extra',approvalId:a.id,approvalStatus:'approved'});}
  // Revalidate ALL linked extras on every update; revoked approval cannot remain
  // serviceable simply because another booked line is being recorded now.
  for(const line of ledger.lines){if(line.source==='approved_extra'){if(!line.approvalId)throw conflict();const a=(await tx.get(db.collection('approvals').doc(line.approvalId))).data();if(!a||a['id']!==line.approvalId||a['status']!=='approved'||a['serviceId']!==line.serviceId||['tenantId','studioId','jobId','customerId','vehicleId'].some(k=>a[k]!==scope[k as keyof typeof scope]))throw conflict();}}
  const line=data.action==='seal'?null:ledger.lines.find(candidate=>candidate.id===data.lineId);if(data.action!=='seal'&&!line)throw conflict();const now=new Date().toISOString();
  if(data.action==='seal'){const issues=reviewPerformedWork(ledger,{scope,vehicleActive:true,terms:[],targets}).filter(issue=>!['terms_missing','terms_changed','removal_terms'].includes(issue.code));if(!snap||issues.length)throw new HttpsError('failed-precondition','Record and check every work item before locking work.');ledger.sealedAt=now;}else if(data.action==='record'){
   if((line!.source==='approved_extra'?line!.approvalId:null)!==data.approvalId)throw conflict();const work=data.work;const detail=work.kind==='install'||work.kind==='replace'?work.product:null;
   // Targeted lifecycle work binds the EXACT Protection record the staff
   // member reviewed: same tenant, car and current customer, a cosmetic
   // (ppf/ceramic) kind, current lifecycle and the exact declared revision
   // (legacy records are the explicit 0). A replacement is like-for-like
   // only - same kind and same recorded coverage scope; anything else must
   // be declared as a removal plus a new install. One old record can never
   // be named by two lines. The Protection document itself is never written
   // here; the immutable connection is this fact in the ledger history.
   let target:LifecycleTarget|null=null;
   if(work.kind==='replace'||work.kind==='remove'){
    target=targets.find(t=>t.id===work.targetId)??null;
    if(!target||!target.current||target.revision!==work.targetRevision||target.scope.tenantId!==scope.tenantId||target.scope.vehicleId!==scope.vehicleId||target.scope.customerId!==scope.customerId||!target.productKind)throw conflict();
    if(ledger.facts.some(f=>f.lineId!==line!.id&&f.targetId===work.targetId))throw conflict();
    if(work.kind==='replace'&&(!target.coverage||target.productKind!==work.product.kind||target.coverage!==work.product.coverage))throw conflict();
   }
   if(detail&&products[detail.id]&&products[detail.id]!==detail.label)throw new HttpsError('failed-precondition','The product reference has a different label.');if(detail)products[detail.id]=detail.label;line!.productId=work.kind==='remove'?target!.productId:detail?.id??null;
   // Explicit staff attestation is not a manufacturer verification or warranty.
   const fact:WorkFact=work.kind==='remove'
    ?{lineId:line!.id,action:'remove',productId:target!.productId,productKind:target!.productKind??null,coverage:target!.coverage,targetId:work.targetId,targetRevision:work.targetRevision,performedBy:user.uid,performedAt:now,qcBy:null,qcAt:null,warranty:{kind:'unknown'}}
    :{lineId:line!.id,action:work.kind==='replace'?'replace':detail?'install':'service',productId:detail?.id??null,productKind:detail?.kind??null,coverage:detail?.coverage??null,targetId:work.kind==='replace'?work.targetId:null,targetRevision:work.kind==='replace'?work.targetRevision:null,performedBy:user.uid,performedAt:now,qcBy:null,qcAt:null,warranty:{kind:'unknown'}};
   ledger.facts=ledger.facts.filter(f=>f.lineId!==line!.id);ledger.facts.push(fact);for(let n=evidence.length-1;n>=0;n--)if(evidence[n]!.lineId===line!.id)evidence.splice(n,1);
  }else{const facts=ledger.facts.filter(f=>f.lineId===line!.id);if(facts.length!==1)throw conflict();facts[0]!.qcBy=user.uid;facts[0]!.qcAt=now;}
  ledger.revision++;const historyRef=workRef.collection('revisions').doc(String(ledger.revision));if((await tx.get(historyRef)).exists)throw conflict();const next={sourceJobHash,ledger,products,evidence};if(!workSnapshotSchema.safeParse(next).success)throw conflict();
  tx.set(workRef,next);tx.set(historyRef,next);tx.set(receiptRef,{payloadHash,operationId:data.operationId,jobId:j.id,revision:ledger.revision,tenantId:scope.tenantId,uid:user.uid,createdAt:now});writeAuditLog(tx,{action:data.action==='record'?'work.recorded':data.action==='qc'?'work.qcRecorded':'work.sealed',entityType:'jobPerformedWork',entityId:j.id,user,studioId:scope.studioId,before:{revision:data.expectedRevision},after:{revision:ledger.revision,lineId:line?.id??null,targetId:data.action==='record'&&(data.work.kind==='replace'||data.work.kind==='remove')?data.work.targetId:null}});
  return{jobId:j.id,operationId:data.operationId,committedRevision:ledger.revision,alreadyRecorded:false};
 });
});

// Exact readback for a durable pending command. not_found NEVER unlocks a new
// operation: a prior request could still be in flight. Reuse the original key.
export const getWorkRecordReceipt=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const parsed=input.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Check the saved work submission.');const data=parsed.data;await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore();
 return db.runTransaction(async tx=>{const j=await tx.get(db.collection('jobs').doc(data.jobId)),job=j.data();if(!job||job['id']!==j.id||job['tenantId']!==user.claims.tenantId||typeof job['vehicleId']!=='string'||typeof job['customerId']!=='string'||user.claims.role==='studio'&&job['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');const[v,c,r]=await Promise.all([tx.get(db.collection('vehicles').doc(job['vehicleId'])),tx.get(db.collection('customers').doc(job['customerId'])),tx.get(db.collection('workRecordReceipts').doc(hash([user.claims.tenantId,user.uid,data.jobId,data.operationId].join('|'))))]);const car=v.data(),customer=c.data();if(!car||car['id']!==v.id||car['tenantId']!==user.claims.tenantId||car['deletedAt']||car['ownerId']!==job['customerId']||!customer||customer['id']!==c.id||customer['tenantId']!==user.claims.tenantId||customer['deletedAt'])throw new HttpsError('not-found','Visit unavailable.');if(!r.exists)return{status:'not_found' as const};const receipt=r.data()!;if(receipt['payloadHash']!==hash(JSON.stringify(data))||receipt['revision']!==data.expectedRevision+1)throw new HttpsError('failed-precondition','Saved submission differs from its receipt.');return{status:'committed' as const,receipt:{jobId:data.jobId,operationId:data.operationId,committedRevision:receipt['revision'],alreadyRecorded:true}}});
});
