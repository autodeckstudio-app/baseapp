import{createHash}from'node:crypto';
import{z}from'zod';
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore,FieldPath,type Transaction,type Firestore}from'firebase-admin/firestore';
import{checkIntakeReview,visitIntakeIssue,visitIntakeTotal,type VisitIntake,type VisitIntakeLine,type Service,type StudioConfig,type Vehicle,type Booking,type ServiceJob,type SharedVisit}from'@autodeck/core';
import{extractUser,extractCustomerUser,assertRole}from'../../middleware/auth.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{writeAuditLog}from'../../middleware/audit.js';
import{requireCustomerDocId}from'../../lib/customer-identity.js';
import{calculatePrice,taxFor}from'../../lib/pricing.js';
import{QUOTE_VALID_MS}from'../../lib/quote-lifecycle.js';
import{freezeConsultQuoteApproval}from'../../lib/consult-approval-binding.js';
import{computeScheduleEnd,utcToLocalDate,utcToLocalTime}from'../../lib/schedule.js';
const id=z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),money=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const start=z.object({operationId:z.string().uuid(),customerId:id,vehicleId:id,studioId:id,serviceIds:z.array(id).min(2).max(20),notes:z.string().trim().max(2000).optional()}).strict();
const offer=z.object({intakeId:id,expectedRevision:z.number().int().positive(),quoteBases:z.array(z.object({lineId:id,basePricePaise:money.positive()}).strict()).max(20)}).strict();
const response=z.object({intakeId:id,expectedRevision:z.number().int().positive(),expectedTotalPaise:money,lineIds:z.array(id).min(2).max(20),decision:z.enum(['accepted','declined'])}).strict();
const cursor=z.object({id,createdAt:z.string().datetime()}).strict();
type StoredIntake=VisitIntake&{notes:string|null;createdAt:string;createdBy:string;updatedAt:string;acceptedAt:string|null;visitId:string|null;vehicleCategory:Vehicle['category'];sourceHash:string};
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,value])=>[k,stable(value)])):v;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
async function owner(tx:Transaction,db:Firestore,i:{tenantId:string;customerId:string;vehicleId:string},uid?:string){
 const[c,v]=await Promise.all([tx.get(db.collection('customers').doc(i.customerId)),tx.get(db.collection('vehicles').doc(i.vehicleId))]);
 if(!c.exists||c.data()?.['id']!==i.customerId||c.data()?.['tenantId']!==i.tenantId||c.data()?.['deletedAt']||uid&&c.data()?.['authUid']!==uid||!v.exists||v.data()?.['id']!==i.vehicleId||v.data()?.['tenantId']!==i.tenantId||v.data()?.['ownerId']!==i.customerId||v.data()?.['deletedAt'])throw new HttpsError('failed-precondition','Current customer or car needs review.');
 return v.data() as Vehicle;
}
const publicView=(i:StoredIntake)=>({id:i.id,revision:i.revision,status:i.status,customerId:i.customerId,vehicleId:i.vehicleId,studioId:i.studioId,expiresAt:i.expiresAt,lines:i.lines.map(line=>({id:line.id,serviceId:line.serviceId,name:line.name,workingMinutes:line.workingMinutes,priceKind:line.priceKind,totalAmount:line.price?.total??null})),totalAmount:visitIntakeTotal(i),visitId:i.visitId});
/** Staff prepares one itemized estimate. No job, bay lock, invoice, charge or
 * work permission exists until the authenticated customer accepts it. */
export const prepareWalkinVisitIntake=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const parsed=start.safeParse(request.data);if(!parsed.success||new Set(parsed.data.serviceIds).size!==parsed.data.serviceIds.length)throw new HttpsError('invalid-argument','Choose each service once.');const d=parsed.data;if(user.claims.role==='studio'&&user.claims.studioId!==d.studioId)throw new HttpsError('permission-denied','Another studio.');await enforceRateLimit(subjectFrom(user),'job.walkinCreate');
 const db=getFirestore(),intakeId=`intake_${hash([user.claims.tenantId,user.uid,d.operationId])}`,ref=db.collection('visitIntakes').doc(intakeId),sourceHash=hash(d);
 return db.runTransaction(async tx=>{
  const prior=(await tx.get(ref)).data() as StoredIntake|undefined;if(prior){if(prior.sourceHash!==sourceHash)throw new HttpsError('already-exists','Saved estimate differs.');return publicView(prior)}
  const car=await owner(tx,db,{tenantId:user.claims.tenantId,customerId:d.customerId,vehicleId:d.vehicleId});if(!car.category)throw new HttpsError('failed-precondition','Set the saved car type before preparing its estimate.');
  const cfg=(await tx.get(db.collection('studioConfig').doc(d.studioId))).data() as StudioConfig|undefined;
  if(!cfg||cfg.tenantId!==user.claims.tenantId)throw new HttpsError('not-found','Studio unavailable.');
  const services=await Promise.all(d.serviceIds.map(async serviceId=>{const s=(await tx.get(db.collection('services').doc(serviceId))).data() as Service|undefined;if(!s||s.id!==serviceId||s.tenantId!==user.claims.tenantId||!s.active||s.catalogueEntryKind==='enquiry')throw new HttpsError('failed-precondition','Selected service unavailable.');return s}));
  const lines:VisitIntakeLine[]=services.map((s,index)=>({id:`line_${index}`,serviceId:s.id,name:s.name,workingMinutes:s.estimatedDurationMinutes,priceKind:s.priceOnRequest?'quote':'fixed',price:s.priceOnRequest?null:calculatePrice({basePrice:s.basePrice,vehicleCategory:car.category!,serviceCategory:s.category,vehicleCategoryPricing:s.vehicleCategoryPricing,...taxFor(cfg),currency:cfg.currency}),offeredBy:null}));
  const now=new Date().toISOString(),intake:StoredIntake={id:intakeId,tenantId:user.claims.tenantId,studioId:d.studioId,customerId:d.customerId,vehicleId:d.vehicleId,revision:1,status:'draft',notes:d.notes??null,lines,expiresAt:null,createdAt:now,createdBy:user.uid,updatedAt:now,acceptedAt:null,visitId:null,vehicleCategory:car.category,sourceHash};
  const issue=visitIntakeIssue(intake);if(issue&&issue!=='quote_needed')throw new HttpsError('failed-precondition','Selected service estimate needs office review.');
  // Fixed services can be offered at their exact server price immediately.
  if(visitIntakeTotal(intake)!==null){intake.status='offered';intake.expiresAt=new Date(Date.now()+QUOTE_VALID_MS).toISOString()}
  tx.create(ref,intake);tx.create(ref.collection('revisions').doc('1'),intake);writeAuditLog(tx,{action:'visit.intakePrepared',entityType:'visitIntake',entityId:intake.id,user,studioId:d.studioId,after:{serviceIds:d.serviceIds,revision:1}});return publicView(intake);
 });
});
/** Same role boundary as the existing service quote: only office admins set
 * a quote-only amount. Fixed service snapshots are never silently repriced. */
export const offerWalkinVisitIntake=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const parsed=offer.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Review the estimate.');const d=parsed.data;await enforceRateLimit(subjectFrom(user),'booking.quote');const db=getFirestore(),ref=db.collection('visitIntakes').doc(d.intakeId);
 return db.runTransaction(async tx=>{
  const i=(await tx.get(ref)).data() as StoredIntake|undefined;if(!i||i.tenantId!==user.claims.tenantId)throw new HttpsError('not-found','Estimate unavailable.');if(i.revision!==d.expectedRevision||!['draft','offered'].includes(i.status))throw new HttpsError('failed-precondition','Estimate changed. Reload.');const history=(await tx.get(ref.collection('revisions').doc(String(i.revision)))).data();if(!history||hash(history)!==hash(i))throw new HttpsError('failed-precondition','Estimate history needs review.');const car=await owner(tx,db,i);if(car.category!==i.vehicleCategory)throw new HttpsError('failed-precondition','Car type changed. Prepare a fresh estimate.');
  const cfg=(await tx.get(db.collection('studioConfig').doc(i.studioId))).data() as StudioConfig|undefined;if(!cfg||cfg.tenantId!==i.tenantId)throw new HttpsError('failed-precondition','Studio unavailable.');
  const quotes=i.lines.filter(l=>l.priceKind==='quote');if(d.quoteBases.length!==quotes.length||new Set(d.quoteBases.map(l=>l.lineId)).size!==quotes.length||quotes.some(l=>!d.quoteBases.some(q=>q.lineId===l.id)))throw new HttpsError('failed-precondition','Price every quote service once.');
  const lines=await Promise.all(i.lines.map(async line=>{const svc=(await tx.get(db.collection('services').doc(line.serviceId))).data() as Service|undefined;if(!svc||!svc.active||svc.tenantId!==i.tenantId||svc.catalogueEntryKind==='enquiry'||svc.name!==line.name||svc.estimatedDurationMinutes!==line.workingMinutes)throw new HttpsError('failed-precondition','Service changed. Prepare a fresh estimate.');if(line.priceKind==='fixed')return line;const base=d.quoteBases.find(q=>q.lineId===line.id)!;return{...line,offeredBy:user.uid,price:calculatePrice({basePrice:base.basePricePaise,vehicleCategory:i.vehicleCategory!,serviceCategory:svc.category,vehicleCategoryPricing:svc.vehicleCategoryPricing,...taxFor(cfg),currency:cfg.currency})}}));
  const now=new Date().toISOString(),next:StoredIntake={...i,lines,revision:i.revision+1,status:'offered',expiresAt:new Date(Date.now()+QUOTE_VALID_MS).toISOString(),updatedAt:now};if(visitIntakeTotal(next)===null)throw new HttpsError('failed-precondition','Check every offered price.');tx.set(ref,next);tx.create(ref.collection('revisions').doc(String(next.revision)),next);writeAuditLog(tx,{action:'visit.intakeOffered',entityType:'visitIntake',entityId:i.id,user,studioId:i.studioId,after:{revision:next.revision,total:visitIntakeTotal(next)}});return publicView(next);
 });
});
/** One authenticated itemized decision creates all independent jobs together,
 * on standby with no bay held. Existing bay admission performs scheduling.
 * This is not payment, and later extras still use the existing approval path. */
export const respondToWalkinVisitIntake=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractCustomerUser(request);assertRole(user,'customer');const parsed=response.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Review every estimate item.');const d=parsed.data;await enforceRateLimit(subjectFrom(user),'booking.quoteRespond');const db=getFirestore(),customerId=await requireCustomerDocId(db,'customers',user.claims.tenantId,user.uid),ref=db.collection('visitIntakes').doc(d.intakeId),responseHash=hash(d);
 return db.runTransaction(async tx=>{
  const i=(await tx.get(ref)).data() as StoredIntake|undefined;if(!i||i.tenantId!==user.claims.tenantId||i.customerId!==customerId)throw new HttpsError('not-found','Estimate unavailable.');
  const car=await owner(tx,db,i,user.uid);if(car.category!==i.vehicleCategory)throw new HttpsError('failed-precondition','Car type changed. Ask for a fresh estimate.');
  if(['accepted','declined'].includes(i.status)){if((i as StoredIntake&{responseHash?:string}).responseHash!==responseHash)throw new HttpsError('failed-precondition','This estimate already has a different decision.');return publicView(i)}
  const history=(await tx.get(ref.collection('revisions').doc(String(i.revision)))).data();if(!history||hash(history)!==hash(i))throw new HttpsError('failed-precondition','Estimate history needs review.');
  const issue=checkIntakeReview(i,{revision:d.expectedRevision,totalAmount:d.expectedTotalPaise,lineIds:d.lineIds},Date.now());if(issue)throw new HttpsError('failed-precondition',`Review the current complete estimate: ${issue.replace(/_/g,' ')}`);
  const now=new Date(),nowIso=now.toISOString();
  if(d.decision==='declined'){tx.update(ref,{status:'declined',updatedAt:nowIso,responseHash});writeAuditLog(tx,{action:'visit.intakeDeclined',entityType:'visitIntake',entityId:i.id,user,studioId:i.studioId,after:{revision:i.revision}});return publicView({...i,status:'declined'})}
  const cfg=(await tx.get(db.collection('studioConfig').doc(i.studioId))).data() as StudioConfig|undefined;if(!cfg||cfg.tenantId!==i.tenantId)throw new HttpsError('failed-precondition','Studio unavailable.');
  const carLock=db.collection('visitIntakeLocks').doc(hash([i.tenantId,i.vehicleId]));await tx.get(carLock);
  const existingJobs=await tx.get(db.collection('jobs').where('tenantId','==',i.tenantId).where('vehicleId','==',i.vehicleId).where('status','in',['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK','READY_FOR_DELIVERY']).limit(1));
  if(!existingJobs.empty)throw new HttpsError('failed-precondition','This car already has open work. Review its existing visit before creating another.');
  for(const line of i.lines){const svc=(await tx.get(db.collection('services').doc(line.serviceId))).data() as Service|undefined;if(!svc||svc.id!==line.serviceId||svc.tenantId!==i.tenantId||!svc.active||svc.catalogueEntryKind==='enquiry'||svc.name!==line.name||svc.estimatedDurationMinutes!==line.workingMinutes)throw new HttpsError('failed-precondition','A selected service changed. Ask for a fresh estimate.')}
  const visitId=`visit_${hash([i.id,i.revision])}`,visitRef=db.collection('carVisits').doc(visitId);if((await tx.get(visitRef)).exists)throw new HttpsError('failed-precondition','Visit identity already exists. Office review needed.');
  // No service can be accidentally created twice under a different operation.
  const ids=i.lines.map(line=>({line,jobId:`job_${hash([i.id,line.id])}`,bookingId:`booking_${hash([i.id,line.id])}`}));
  for(const item of ids){if((await tx.get(db.collection('jobs').doc(item.jobId))).exists||(await tx.get(db.collection('bookings').doc(item.bookingId))).exists)throw new HttpsError('failed-precondition','Intake records need office review.')}
  // Finish all pure schedule and consent calculations before first write.
  const prepared=ids.map(({line,jobId,bookingId})=>{
   const end=computeScheduleEnd(now,line.workingMinutes,cfg.operatingHours,cfg.holidays,cfg.timezone),scheduledDate=utcToLocalDate(now,cfg.timezone),estimatedEndDate=utcToLocalDate(end,cfg.timezone),price=line.price!;
   const shared={tenantId:i.tenantId,studioId:i.studioId,customerId:i.customerId,vehicleId:i.vehicleId,serviceId:line.serviceId,visitId,bayId:'',assignedEmployeeId:null,scheduledAt:nowIso,scheduledDate,estimatedEndAt:end.toISOString(),estimatedEndDate,priceBreakdown:price,totalAmount:price.total,paymentStatus:'unpaid' as const,createdAt:nowIso,updatedAt:nowIso,standbyArrivedAt:nowIso,standbyAdmittedAt:null};
   const lines=[{serviceId:line.serviceId,name:line.name,price:price.total,durationMinutes:line.workingMinutes}];
   const booking:Booking={...shared,id:bookingId,vehicleCategory:i.vehicleCategory!,scheduledTime:utcToLocalTime(now,cfg.timezone),estimatedEndTime:utcToLocalTime(end,cfg.timezone),durationMinutes:line.workingMinutes,status:'ACTIVE',lines,membershipId:null,membershipDiscountApplied:false,membershipWashUsed:false,payMode:'studio',holdExpiresAt:null,notes:i.notes,idempotencyKey:i.id+'_'+line.id,rescheduleCount:0,confirmedAt:nowIso,cancelledAt:null,cancellationReason:null,...(line.priceKind==='quote'?{priceOnRequest:true,quoteStatus:'approved' as const,quoteRespondedAt:nowIso}:{})};
   const job:ServiceJob={...shared,id:jobId,bookingId,status:'STANDBY',lines,statusHistory:[{status:'STANDBY',changedAt:nowIso,changedBy:user.uid,notes:'Itemized intake accepted. Waiting for bay.'}],estimatedDurationMinutes:line.workingMinutes,studioNotes:i.notes,additionalWorkDelta:0,isWalkIn:true,sealedAt:null};
   const consent=line.priceKind==='quote'?freezeConsultQuoteApproval({version:1,bookingId,jobId,tenantId:i.tenantId,customerId:i.customerId,quotedTotalPaise:price.total,pickupFeePaise:0,dropFeePaise:0,quotedAt:i.updatedAt},customerId,nowIso):null;
   return{booking,job,consent};
  });
  const visit:SharedVisit={id:visitId,tenantId:i.tenantId,studioId:i.studioId,customerId:i.customerId,vehicleId:i.vehicleId,jobIds:ids.map(item=>item.jobId),transportJobId:null,revision:1,createdAt:nowIso,createdBy:i.createdBy,updatedAt:nowIso,updatedBy:user.uid};
  tx.set(carLock,{intakeId:i.id,visitId,updatedAt:nowIso});tx.create(visitRef,visit);
  for(const{booking,job,consent}of prepared){if(consent){tx.create(db.collection('consultQuoteApprovals').doc(consent.quoteHash),consent);(booking as Booking&{consultQuoteApproval?:{quoteHash:string}}).consultQuoteApproval={quoteHash:consent.quoteHash}}tx.create(db.collection('bookings').doc(booking.id),{...booking,intakeId:i.id});tx.create(db.collection('jobs').doc(job.id),{...job,intakeId:i.id})}
  tx.update(ref,{status:'accepted',acceptedAt:nowIso,updatedAt:nowIso,visitId,responseHash});writeAuditLog(tx,{action:'visit.intakeAccepted',entityType:'visitIntake',entityId:i.id,user,studioId:i.studioId,after:{revision:i.revision,total:d.expectedTotalPaise,visitId,jobIds:visit.jobIds}});return publicView({...i,status:'accepted',acceptedAt:nowIso,visitId});
 });
});
export const getMyWalkinVisitIntakes=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractCustomerUser(request);assertRole(user,'customer');const parsed=z.object({cursor:cursor.optional(),intakeId:id.optional()}).strict().refine(d=>!d.cursor||!d.intakeId).safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Check estimates.');await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore(),customerId=await requireCustomerDocId(db,'customers',user.claims.tenantId,user.uid);
 return db.runTransaction(async tx=>{const c=(await tx.get(db.collection('customers').doc(customerId))).data();if(!c||c['authUid']!==user.uid||c['deletedAt']||c['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Customer unavailable.');if(parsed.data.intakeId){const i=(await tx.get(db.collection('visitIntakes').doc(parsed.data.intakeId))).data() as StoredIntake|undefined;if(!i||i.id!==parsed.data.intakeId||i.tenantId!==user.claims.tenantId||i.customerId!==customerId)throw new HttpsError('not-found','Estimate unavailable.');return{intakes:[publicView(i)],nextCursor:null}}let query=db.collection('visitIntakes').where('tenantId','==',user.claims.tenantId).where('customerId','==',customerId).where('status','in',['draft','offered']).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');if(parsed.data.cursor)query=query.startAfter(parsed.data.cursor.createdAt,parsed.data.cursor.id);const rows=await tx.get(query.limit(21)),page=rows.docs.slice(0,20);return{intakes:page.map(d=>publicView(d.data() as StoredIntake)),nextCursor:rows.size>20?{id:page[19]!.id,createdAt:page[19]!.data()['createdAt']}:null}});
});
/** Office/studio queue uses the same exact estimate, not a separate quote. */
export const getStaffWalkinVisitIntakes=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const parsed=z.object({studioId:id,cursor:cursor.optional()}).strict().safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Choose the studio.');const studioId=parsed.data.studioId;if(user.claims.role==='studio'&&user.claims.studioId!==studioId)throw new HttpsError('permission-denied','Another studio.');await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore();
 return db.runTransaction(async tx=>{const config=(await tx.get(db.collection('studioConfig').doc(studioId))).data();if(!config||config['tenantId']!==user.claims.tenantId)throw new HttpsError('not-found','Studio unavailable.');let query=db.collection('visitIntakes').where('tenantId','==',user.claims.tenantId).where('studioId','==',studioId).where('status','in',['draft','offered']).orderBy('createdAt','desc').orderBy(FieldPath.documentId(),'desc');if(parsed.data.cursor)query=query.startAfter(parsed.data.cursor.createdAt,parsed.data.cursor.id);const rows=await tx.get(query.limit(21)),page=rows.docs.slice(0,20);const intakes=await Promise.all(page.map(async d=>{const i=d.data() as StoredIntake;const car=await owner(tx,db,i);const c=(await tx.get(db.collection('customers').doc(i.customerId))).data()!;return{...publicView(i),customerName:typeof c['name']==='string'?c['name']:'Customer',vehicleLabel:[car.make,car.model,car.registrationNumber].filter(Boolean).join(' ')}}));return{intakes,nextCursor:rows.size>20?{id:page[19]!.id,createdAt:page[19]!.data()['createdAt']}:null}});
});

/** Close unused estimates or re-offer the same exact amounts with a new
 * review revision. This never cancels accepted work or changes a charge. */
export const manageWalkinVisitIntake=onCall({region:'asia-south1',enforceAppCheck: shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'admin','superadmin');const parsed=z.object({intakeId:id,expectedRevision:z.number().int().positive(),action:z.enum(['cancel','reoffer'])}).strict().safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Review the estimate.');const d=parsed.data;await enforceRateLimit(subjectFrom(user),'booking.quote');const db=getFirestore(),ref=db.collection('visitIntakes').doc(d.intakeId);
 return db.runTransaction(async tx=>{
  const i=(await tx.get(ref)).data() as StoredIntake|undefined;if(!i||i.tenantId!==user.claims.tenantId)throw new HttpsError('not-found','Estimate unavailable.');
  if(i.status==='cancelled'&&d.action==='cancel'&&d.expectedRevision===i.revision)return publicView(i);
  if(!['draft','offered'].includes(i.status)||i.revision!==d.expectedRevision)throw new HttpsError('failed-precondition','Estimate changed. Reload before acting.');const history=(await tx.get(ref.collection('revisions').doc(String(i.revision)))).data();if(!history||hash(history)!==hash(i))throw new HttpsError('failed-precondition','Estimate history needs review.');
  const car=await owner(tx,db,i),now=new Date().toISOString();
  if(d.action==='cancel'){tx.update(ref,{status:'cancelled',updatedAt:now});writeAuditLog(tx,{action:'visit.intakeCancelled',entityType:'visitIntake',entityId:i.id,user,studioId:i.studioId,after:{revision:i.revision}});return publicView({...i,status:'cancelled',updatedAt:now})}
  if(car.category!==i.vehicleCategory||visitIntakeTotal(i)===null)throw new HttpsError('failed-precondition','Prepare the complete current estimate first.');
  if(i.status==='offered'&&i.expiresAt&&Date.parse(i.expiresAt)>Date.now())throw new HttpsError('failed-precondition','This estimate is still awaiting customer review.');
  const cfg=(await tx.get(db.collection('studioConfig').doc(i.studioId))).data();if(!cfg||cfg['tenantId']!==i.tenantId)throw new HttpsError('failed-precondition','Studio unavailable.');
  for(const l of i.lines){const s=(await tx.get(db.collection('services').doc(l.serviceId))).data();if(!s||s['id']!==l.serviceId||s['tenantId']!==i.tenantId||s['active']!==true||s['catalogueEntryKind']==='enquiry'||s['name']!==l.name||s['estimatedDurationMinutes']!==l.workingMinutes)throw new HttpsError('failed-precondition','Service changed. Prepare a fresh estimate.')}
  const next:StoredIntake={...i,revision:i.revision+1,status:'offered',expiresAt:new Date(Date.now()+QUOTE_VALID_MS).toISOString(),updatedAt:now};if((await tx.get(ref.collection('revisions').doc(String(next.revision)))).exists)throw new HttpsError('failed-precondition','Estimate history needs review.');tx.set(ref,next);tx.create(ref.collection('revisions').doc(String(next.revision)),next);writeAuditLog(tx,{action:'visit.intakeOffered',entityType:'visitIntake',entityId:i.id,user,studioId:i.studioId,after:{revision:next.revision,total:visitIntakeTotal(next),reoffered:true}});return publicView(next);
 });
});
