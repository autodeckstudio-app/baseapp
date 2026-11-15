import{readCustomerNotificationTarget}from'./customer-notification-target.js';
import {createHash}from'node:crypto';
import type{Firestore}from'firebase-admin/firestore';
import type{AuditLog,VisitIntake}from'@autodeck/core';
import{visitIntakeTotal}from'@autodeck/core';
import type{NotificationDraft}from'./notification-events.js';
const stable=(v:unknown):unknown=>Array.isArray(v)?v.map(stable):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,value])=>[k,stable(value)])):v;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(stable(v))).digest('hex');
/** Do not let delayed audit delivery announce an expired, changed or already
 * answered offer. The exact offer revision owns one notification key. */
export async function visitIntakeNotification(db:Firestore,log:AuditLog):Promise<NotificationDraft|null>{
 if(!Number.isSafeInteger(log.after?.['revision']))return null;
 return db.runTransaction(async tx=>{
  const snap=await tx.get(db.collection('visitIntakes').doc(log.entityId)),i=snap.data() as VisitIntake|undefined;
  if(!i||i.id!==snap.id||i.tenantId!==log.tenantId||i.studioId!==log.studioId||i.revision!==log.after?.['revision']||i.status!=='offered'||!i.expiresAt||Date.parse(i.expiresAt)<=Date.now()||visitIntakeTotal(i)===null)return null;
  const history=(await tx.get(snap.ref.collection('revisions').doc(String(i.revision)))).data();if(!history||hash(history)!==hash(i))return null;
  const[c,v]=await Promise.all([tx.get(db.collection('customers').doc(i.customerId)),tx.get(db.collection('vehicles').doc(i.vehicleId))]);
  if(!c.exists||c.data()?.['tenantId']!==i.tenantId||c.data()?.['deletedAt']||!v.exists||v.data()?.['tenantId']!==i.tenantId||v.data()?.['ownerId']!==i.customerId||v.data()?.['deletedAt'])return null;
  const userId=await readCustomerNotificationTarget(tx,db,i.tenantId,i.customerId);if(!userId)return null;
  const name=typeof v.data()?.['model']==='string'?v.data()!['model']:'car';
  return{userId,type:'approval_requested',title:'Review your visit',body:`${i.lines.length} services for your ${name} need your approval. No payment now.`,entityType:'VisitIntake',entityId:i.id,dedupeKey:`intake-${i.id}-offer-${i.revision}`};
 });
}
