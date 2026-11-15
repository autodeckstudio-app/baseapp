import{websiteCatalogueProjection}from'../../lib/catalogue-website-projection.js';
import {onRequest}from'firebase-functions/v2/https';
import {getFirestore}from'firebase-admin/firestore';
import {buildCustomerCatalogueSnapshot,type CustomerCatalogueSnapshot}from'../../lib/catalogue-customer-snapshot.js';
import type{Service}from'@autodeck/core';
// Shared internal reader. The anonymous HTTP handler projects a separate
// price-free website allowlist; the signed-in Customer reader remains unchanged.
export async function readPublicCatalogue(tenantId='automodz'):Promise<CustomerCatalogueSnapshot>{
 const db=getFirestore();return db.runTransaction(async tx=>{
  const snapshot=await tx.get(db.collection('catalogueCustomerSnapshots').doc(tenantId));
  if(snapshot.exists){const row=snapshot.data()as CustomerCatalogueSnapshot;if(row.tenantId!==tenantId||!row.publishId||!row.hash)throw Error('Invalid customer snapshot');return row;}
  const source=await tx.get(db.collection('services').where('tenantId','==',tenantId));
  return buildCustomerCatalogueSnapshot({tenantId,publishId:'baseline-customer-menu',publishedAt:null,rows:source.docs.map(d=>d.data()as Service),changes:[]});
 });
}
export const getPublicCatalogue=onRequest({region:'asia-south1',cors:['https://www.autodeck.in','https://autodeck.in','https://admin.autodeck.in','https://app.autodeck.in'],maxInstances:5,timeoutSeconds:30},async(req,res)=>{
 res.set('Cache-Control','no-store, max-age=0');res.set('X-Content-Type-Options','nosniff');
 if(req.method!=='GET'){res.status(405).json({error:'Read-only catalogue'});return;}
 try{const data=await readPublicCatalogue();res.status(200).json(websiteCatalogueProjection(data))}catch{res.status(503).json({error:'Catalogue could not be checked. Please try again.'})}
});
