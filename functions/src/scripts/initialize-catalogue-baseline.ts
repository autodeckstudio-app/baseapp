/** Run with the AutoDeck deployment identity only. Dry run is the default.
 * This script does not grant release authority. Never apply before approval. */
import{initializeApp,getApps}from'firebase-admin/app';import{getFirestore}from'firebase-admin/firestore';import{planCatalogueBaseline,initializeCatalogueBaseline}from'../lib/catalogue-baseline.js';import type{Service}from'@autodeck/core';
async function main(){
 const args=process.argv.slice(2),project=process.env['GCLOUD_PROJECT'];
 if(!project||!['autodeck-studio','demo-autodeck-catalogue'].includes(project))throw Error('Choose the exact AutoDeck project explicitly');
 if(!getApps().length)initializeApp({projectId:project});const db=getFirestore();
 if(args[0]==='--apply'){const digest=args[1];if(args.length!==2||!digest)throw Error('Apply requires one exact reviewed digest');console.log(JSON.stringify(await initializeCatalogueBaseline(db,digest),null,2));return;}
 if(args.length)throw Error('Use no arguments for a read-only plan, or --apply REVIEWED_DIGEST after release approval');
 const rows=await db.collection('services').where('tenantId','==','automodz').get();
 console.log(JSON.stringify(planCatalogueBaseline(rows.docs.map(doc=>({...doc.data(),id:doc.id})as Service)),null,2));
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
