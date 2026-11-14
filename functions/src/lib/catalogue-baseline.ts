import{referenceEntry}from'./catalogue-reference-entries.js';import{referenceChoices,alignedCustomerServices}from'@autodeck/core';
import type{Firestore}from'firebase-admin/firestore';
import type{Service}from'@autodeck/core';
import{buildCustomerCatalogueSnapshot}from'./catalogue-customer-snapshot.js';
import{catalogueReviewHash}from'./catalogue-draft.js';
export function planCatalogueBaseline(rows:Service[]){
 const tenantId='automodz';
 const sources=rows.filter(row=>row.tenantId===tenantId).map(row=>({id:row.id,updatedAt:row.updatedAt})).sort((a,b)=>a.id.localeCompare(b.id));
 const referenceEntries=rows.some(row=>row.catalogueEntryKind==='enquiry')?[]:referenceChoices(alignedCustomerServices(rows)).map((ref,index)=>referenceEntry(ref,index));const snapshot=buildCustomerCatalogueSnapshot({tenantId,publishId:'baseline-customer-menu',publishedAt:null,rows:[...rows,...referenceEntries],changes:[]});
 return{tenantId,sources,snapshot,referenceEntries,digest:catalogueReviewHash({tenantId,sources,snapshot,referenceEntries})};
}
/** Deployment-only migration. Not a callable. Requires the operator to have
 * reviewed the exact dry-run digest. It creates one snapshot and exact nonbookable enquiry registry entries.
 * Never replace an existing snapshot or an in-flight publication. */
export async function initializeCatalogueBaseline(db:Firestore,expectedDigest:string){
 if(!/^[a-f0-9]{64}$/.test(expectedDigest))throw Error('Exact reviewed baseline digest required');
 return db.runTransaction(async tx=>{
  const ref=db.collection('catalogueCustomerSnapshots').doc('automodz');
  const prior=await tx.get(ref),lock=await tx.get(db.collection('cataloguePublishLocks').doc('automodz'));
  if(prior.exists)throw Error('A catalogue snapshot already exists; do not replace it');
  if(lock.data()?.['activePublishId'])throw Error('An unfinished publication must be checked first');
  const rows=await tx.get(db.collection('services').where('tenantId','==','automodz'));
  const plan=planCatalogueBaseline(rows.docs.map(doc=>({...doc.data(),id:doc.id})as Service));
  if(plan.digest!==expectedDigest)throw Error('Catalogue changed since baseline review. Prepare a new plan');
  const existingReferences=await Promise.all(plan.referenceEntries.map(row=>tx.get(db.collection('services').doc(row.id))));if(existingReferences.some(doc=>doc.exists))throw Error('Reference identities already exist; review baseline again');for(const row of plan.referenceEntries)tx.create(db.collection('services').doc(row.id),row);tx.create(ref,plan.snapshot);
  return{publishId:plan.snapshot.publishId,hash:plan.snapshot.hash,digest:plan.digest,count:plan.snapshot.services.length};
 });
}
