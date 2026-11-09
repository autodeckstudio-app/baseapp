import {HttpsError} from 'firebase-functions/v2/https';
import type {Firestore} from 'firebase-admin/firestore';
import type {Booking,Payment} from '@autodeck/core';
import type {AuthorizedUser} from '@autodeck/auth';
import {readCombinedFunding} from './combined-return.js';
import {writeAuditLog} from '../middleware/audit.js';
import {getPaymentProvider} from './razorpay-provider.js';
/** Save the retained-slot intent before closing the link, so a racing capture sees the intent. No refund or cancellation here. */
export async function requestCombinedWaitingCancel(db:Firestore,user:AuthorizedUser,data:{bookingId:string;reason:string;preview?:boolean|undefined},actor:'admin'|'customer'){
 if(!['admin','superadmin','customer'].includes(user.claims.role)||(actor==='admin'&&user.claims.role==='customer'))throw new HttpsError('permission-denied','Cancellation role unavailable.');
 const result=await db.runTransaction(async tx=>{
  const ref=db.collection('bookings').doc(data.bookingId),b=(await tx.get(ref)).data()as Booking|undefined;
  if(!b||b.tenantId!==user.claims.tenantId||(user.claims.studioId&&user.claims.studioId!==b.studioId))throw new HttpsError('permission-denied','Cancellation scope changed.');
  if(actor==='customer'){const c=(await tx.get(db.collection('customers').doc(b.customerId))).data();if(!c||c['authUid']!==user.uid||c['tenantId']!==b.tenantId||c['deletedAt'])throw new HttpsError('permission-denied','Customer scope changed.');}
  if(!['PENDING','CONFIRMED'].includes(b.status))return null;
  const iRef=db.collection('bookingCancelIntents').doc(b.id),old=(await tx.get(iRef)).data();
  const f=await readCombinedFunding(db,tx,b,true);if(!['PENDING_VEHICLE','STANDBY','VEHICLE_RECEIVED'].includes(f.j.status))throw new HttpsError('failed-precondition','Work has started. Admin must review the visit.');
  if(!f.openPayments.length){if(old&&old['version']===2&&['waiting','needs_review'].includes(old['state'])){const p=(await tx.get(db.collection('payments').doc(String(old['paymentId'])))).data()as Payment|undefined;if(!p||p.tenantId!==b.tenantId||p.studioId!==b.studioId||p.customerId!==b.customerId||p.bookingId!==b.id||p.razorpayPaymentLinkId!==old['providerPaymentLinkId'])throw new HttpsError('failed-precondition','Waiting payment identity changed.');if(['failed','cancelled'].includes(p.status)&&!['cancelled','already_inactive'].includes(old['linkCloseOutcome']))return{payment:p,close:!data.preview};}return null;}
  if(f.openPayments.length!==1)throw new HttpsError('failed-precondition','More than one open payment needs office review.');
  const p=f.openPayments[0]!;if(f.paidPaise+p.amount>b.totalAmount)throw new HttpsError('failed-precondition','Open payment plus captured funding exceeds this visit. Office review required.');
  if(old&&(old['version']!==2||old['paymentId']!==p.id||old['tenantId']!==b.tenantId||old['studioId']!==b.studioId||old['customerId']!==b.customerId||old['state']==='resolved'))throw new HttpsError('failed-precondition','Existing cancellation check needs review.');
  if(data.preview||old)return{payment:p,close:!data.preview&&p.status==='pending'};
  const now=new Date().toISOString(),intent={version:2,bookingId:b.id,tenantId:b.tenantId,studioId:b.studioId,customerId:b.customerId,jobId:p.jobId??null,paymentId:p.id,providerPaymentLinkId:p.razorpayPaymentLinkId,state:'waiting',requestedAt:now,requestedBy:user.uid,reason:data.reason,reviewAt:b.holdExpiresAt??new Date(Date.now()+900000).toISOString()};
  tx.create(iRef,intent);tx.update(ref,{cancelIntent:{state:'waiting',requestedAt:now},updatedAt:now});
  writeAuditLog(tx,{action:'booking.cancel_requested',entityType:'Booking',entityId:b.id,user,studioId:b.studioId,after:{state:'waiting',combined:true}});
  return{payment:p,close:p.status==='pending'};
 });
 if(!result)return null;
 if(result.close){let outcome:string;try{outcome=(await getPaymentProvider().cancelPaymentLink(result.payment.razorpayPaymentLinkId!)).outcome;}catch{outcome='unverified';}await db.runTransaction(async tx=>{const ref=db.collection('bookingCancelIntents').doc(data.bookingId),i=(await tx.get(ref)).data();if(!i||i['version']!==2||i['paymentId']!==result.payment.id||i['tenantId']!==result.payment.tenantId||i['studioId']!==result.payment.studioId||i['customerId']!==result.payment.customerId||i['state']==='resolved')return;tx.update(ref,{linkCloseOutcome:outcome,linkCloseCheckedAt:new Date().toISOString()});});}
 return{success:true,cancellationPending:true,...(data.preview?{preview:true}:{})};
}
