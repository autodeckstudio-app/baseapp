import{createHash}from'node:crypto';
import{z}from'zod';
import{onCall,HttpsError}from'firebase-functions/v2/https';
import{getFirestore}from'firebase-admin/firestore';
import{extractUser,assertRole}from'../../middleware/auth.js';
import{shouldEnforceAppCheck}from'../../lib/environment.js';
import{enforceRateLimit,subjectFrom}from'../../middleware/rateLimit.js';
import{writeAuditLog}from'../../middleware/audit.js';
import{readVisitBilling}from'../../lib/visit-billing.js';
const schema=z.object({visitId:z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/),reviewToken:z.string().regex(/^[a-f0-9]{64}$/),operationId:z.string().uuid(),confirmed:z.literal(true)}).strict();
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** Freeze one exact itemized collection review. This is not invoice issue,
 * receipt, payment creation, provider work or permission to change history. */
export const prepareVisitBill=onCall({region:'asia-south1',enforceAppCheck:shouldEnforceAppCheck()},async request=>{
 const user=extractUser(request);assertRole(user,'studio','admin','superadmin');const parsed=schema.safeParse(request.data);if(!parsed.success)throw new HttpsError('invalid-argument','Review the current complete visit bill.');const d=parsed.data;
 await enforceRateLimit(subjectFrom(user),'read.jobs');const db=getFirestore(),opKey=hash([user.claims.tenantId,user.uid,d.operationId]),payloadHash=hash(d),billId='bill_'+hash([d.visitId,d.reviewToken]);
 return db.runTransaction(async tx=>{
  const visit=(await tx.get(db.collection('carVisits').doc(d.visitId))).data();if(!visit||visit['tenantId']!==user.claims.tenantId||user.claims.role==='studio'&&visit['studioId']!==user.claims.studioId)throw new HttpsError('not-found','Visit unavailable.');
  const opRef=db.collection('visitBillOperations').doc(opKey),op=(await tx.get(opRef)).data();
  if(op){if(op['payloadHash']!==payloadHash||op['billId']!==billId)throw new HttpsError('already-exists','Bill operation belongs to another review.');return{billId,alreadyPrepared:true};}
  const current=await readVisitBilling(tx,db,d.visitId);if(current.review.reviewToken!==d.reviewToken||current.visit.activeHandoverId)throw new HttpsError('failed-precondition','Visit bill changed. Review every item again.');
  const billRef=db.collection('visitBills').doc(billId),prior=(await tx.get(billRef)).data(),headRef=db.collection('visitBillHeads').doc(d.visitId),head=(await tx.get(headRef)).data();
  if(prior){if(prior['sourceToken']!==d.reviewToken||prior['visitId']!==d.visitId||prior['tenantId']!==user.claims.tenantId||head?.['billId']!==billId)throw new HttpsError('failed-precondition','Original bill snapshot needs review.');}
  else if(head&&(!Number.isSafeInteger(head['revision'])||head['revision']<1||head['tenantId']!==current.visit.tenantId||head['visitId']!==current.visit.id))throw new HttpsError('failed-precondition','Bill history needs review.');
  const now=new Date().toISOString(),revision=prior?prior['revision']:(head?.['revision']??0)+1;
  if(!Number.isSafeInteger(revision))throw new HttpsError('failed-precondition','Bill revision needs review.');
  if(!prior){
   tx.create(billRef,{id:billId,kind:'visit_collection_bill',status:'prepared',tenantId:current.visit.tenantId,studioId:current.visit.studioId,customerId:current.visit.customerId,vehicleId:current.visit.vehicleId,visitId:d.visitId,revision,membershipRevision:current.visit.revision,sourceToken:d.reviewToken,previousBillId:head?.['billId']??null,currency:'INR',totalPaise:current.review.totalPaise,previouslyAppliedPaise:current.review.appliedPaise,payablePaise:current.review.balancePaise,lines:current.review.lines,createdAt:now,createdBy:user.uid});
   tx.set(headRef,{visitId:d.visitId,tenantId:current.visit.tenantId,billId,revision,updatedAt:now});
  }
  tx.create(opRef,{tenantId:current.visit.tenantId,studioId:current.visit.studioId,payloadHash,billId,createdAt:now,createdBy:user.uid});
  writeAuditLog(tx,{action:'visit.billPrepared',entityType:'visitBill',entityId:billId,user,studioId:current.visit.studioId,after:{visitId:d.visitId,billRevision:revision,membershipRevision:current.visit.revision,totalPaise:current.review.totalPaise,payablePaise:current.review.balancePaise}});
  return{billId,alreadyPrepared:!!prior};
 });
});
