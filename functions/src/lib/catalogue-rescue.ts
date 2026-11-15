import type{Firestore}from'firebase-admin/firestore';
import{catalogueReviewHash,type CatalogueDraft}from'./catalogue-draft.js';
import{commitCataloguePublish,recordCatalogueSheetPhase}from'./catalogue-publish-store.js';

/**
 * One-shot bounded rescue for a wedged managed catalogue publish (phase
 * needs-recovery-readback whose batch is too large for a single 60s inspect).
 * The deployed recovery callables require a full-batch sheet readback inside
 * one invocation; this module performs the same writes and verification in
 * checkpointed slices at the worker's quota pace. Every row write still goes
 * through the private worker's frozen-review binding and readback; the final
 * commit is the unchanged commitCataloguePublish transaction.
 *
 * Idempotence: rows already in the after-state are skipped, the cursor is
 * persisted after each row, and every op re-validates the publish doc, lock,
 * frozen review hashes and service updatedAt before any effect. A row that is
 * neither before- nor after-state aborts the run for human review; nothing is
 * forced.
 */

export type RescuePort={
  inspectExistingRow:(serviceId:string)=>Promise<{serviceId:string;present:true;rowHash:string;cells:string[]}|{serviceId:string;present:false}>;
  inspectNewRow:(serviceId:string,destination:string)=>Promise<{serviceId:string;destination:string;expectedTabHash:string}>;
  writeReviewed:(row:RescueRow,expectedRowHash:string)=>Promise<unknown>;
  writeNewReviewed:(row:RescueRow,destination:string,expectedTabHash:string)=>Promise<unknown>;
};
export type RescueRow={serviceId:string;name:string;brand:string|null;description:string;active:boolean};
export type RescueInput={
  publishId:string;
  op:'write'|'verify'|'commit';
  actor:string;
  actorRole:string;
  cursor?:number;
  limit?:number;
};
export type RescueResult={
  op:string;
  done:boolean;
  nextCursor:number;
  total:number;
  written:number;
  skipped:number;
  checked:number;
  conflicts:string[];
};

const DEFAULT_SLICE_LIMIT=8;
const TIME_BUDGET_MS=420_000;

const frozenHash=(d:CatalogueDraft)=>catalogueReviewHash({id:d.id,tenantId:d.tenantId,serviceId:d.serviceId,expectedServiceUpdatedAt:d.expectedServiceUpdatedAt,version:d.version,payload:d.payload,expectedPublicRowHash:d.expectedPublicRowHash??null,publicDestination:d.publicDestination??null,newServiceId:d.newServiceId??null,expectedNewTabHash:d.expectedNewTabHash??null});

export async function rescueCataloguePublish(db:Firestore,port:RescuePort,input:RescueInput,now:()=>number=()=>Date.now()):Promise<RescueResult>{
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(input.publishId)||!['admin','superadmin'].includes(input.actorRole)||!input.actor)throw Error('Scoped office recovery required');
  const ref=db.collection('cataloguePublishes').doc(input.publishId),lockRef=db.collection('cataloguePublishLocks').doc('automodz');
  const p=(await ref.get()).data();
  if(!p||p['tenantId']!=='automodz')throw Error('Publish unavailable');
  const lock=(await lockRef.get()).data();
  if(lock?.['activePublishId']!==input.publishId)throw Error('Recovery lock mismatch');
  const reviews=p['reviews'] as {draftId:string;reviewHash:string}[];
  const drafts:CatalogueDraft[]=[];
  for(const r of reviews){
    const d=(await db.collection('catalogueDrafts').doc(r.draftId).get()).data() as CatalogueDraft|undefined;
    if(!d||d.tenantId!=='automodz'||d.state!=='publishing'||d.reviewHash!==r.reviewHash||frozenHash(d)!==r.reviewHash)throw Error('Frozen review unavailable');
    if(!(d.serviceId??d.newServiceId))throw Error('Frozen review unavailable');
    drafts.push(d);
  }

  if(input.op==='commit'){
    if(p['phase']!=='sheet-verified')throw Error('Sheet verification incomplete');
    await commitCataloguePublish(db,{id:input.publishId,tenantId:'automodz'});
    return{op:'commit',done:true,nextCursor:drafts.length,total:drafts.length,written:0,skipped:0,checked:0,conflicts:[]};
  }

  const limit=Math.max(1,Math.min(input.limit??DEFAULT_SLICE_LIMIT,20));
  const start=now();
  const expectedCells=(d:CatalogueDraft,active:boolean)=>[(d.serviceId??d.newServiceId)!,d.payload.name,d.payload.brand??'',d.payload.description,active?'active':'hidden'];
  const loadService=async(d:CatalogueDraft)=>{
    const id4=(d.serviceId??d.newServiceId)!;
    const service=(await db.collection('services').doc(id4).get()).data();
    if(d.serviceId?(!service||service['tenantId']!=='automodz'||service['updatedAt']!==d.expectedServiceUpdatedAt):!!service)throw Error('Service changed after Sheet write. Recovery required');
    return{id4,service};
  };

  if(input.op==='write'){
    if(p['phase']!=='needs-recovery-readback'&&p['phase']!=='sheet-write-in-flight')throw Error('Write phase unavailable');
    if(p['phase']==='needs-recovery-readback'){
      const iso=new Date().toISOString();
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref),row=snap.data(),lockSnap=await tx.get(lockRef);
        if(!row||row['phase']!=='needs-recovery-readback'||lockSnap.data()?.['activePublishId']!==input.publishId)throw Error('Recovery state changed');
        tx.update(ref,{phase:'sheet-write-in-flight',updatedAt:iso,rescueResumedAt:iso});
        tx.set(db.collection('auditLog').doc(),{tenantId:'automodz',action:'service.catalogue_recovery_resumed',entityType:'CataloguePublish',entityId:input.publishId,performedBy:input.actor,performedByRole:input.actorRole,createdAt:iso,metadata:{mode:'sliced-write-resume',reviews:reviews.length}});
      });
    }
    let cursor=input.cursor??(typeof p['rescueWriteCursor']==='number'?p['rescueWriteCursor']as number:0);
    let written=0,skipped=0;const conflicts:string[]=[];
    for(let i=cursor;i<drafts.length;i++){
      if(now()-start>TIME_BUDGET_MS)return{op:'write',done:false,nextCursor:i,total:drafts.length,written,skipped,checked:0,conflicts};
      const d=drafts[i]!,{id4,service}=await loadService(d);
      const active=d.payload.active??(d.serviceId?service?.['active']===true:true);
      const row:RescueRow={serviceId:id4,name:d.payload.name,brand:d.payload.brand??null,description:d.payload.description,active};
      const probe=await port.inspectExistingRow(id4);
      if(probe.present){
        if(JSON.stringify(probe.cells)===JSON.stringify(expectedCells(d,active))){skipped++;}
        else if(d.expectedPublicRowHash&&probe.rowHash===d.expectedPublicRowHash){await port.writeReviewed(row,d.expectedPublicRowHash);written++;}
        else conflicts.push(id4);
      }else{
        if(!d.expectedNewTabHash||!d.publicDestination)throw Error('Public row missing without reviewed destination: '+id4);
        const plan=await port.inspectNewRow(id4,d.publicDestination);
        if(plan.expectedTabHash!==d.expectedNewTabHash)throw Error('New target tab changed since review: '+id4);
        await port.writeNewReviewed(row,d.publicDestination,d.expectedNewTabHash);written++;
      }
      if(conflicts.length)throw Error('Public row conflict: '+conflicts.join(','));
      await ref.update({rescueWriteCursor:i+1,updatedAt:new Date().toISOString()});
    }
    return{op:'write',done:true,nextCursor:drafts.length,total:drafts.length,written,skipped,checked:0,conflicts};
  }

  // verify
  if(p['phase']!=='sheet-write-in-flight'&&p['phase']!=='sheet-verified')throw Error('Write phase incomplete');
  let cursor=input.cursor??(typeof p['rescueVerifyCursor']==='number'?p['rescueVerifyCursor']as number:0);
  let checked=0;const conflicts:string[]=[];
  for(let i=cursor;i<drafts.length;i++){
    if(now()-start>TIME_BUDGET_MS)return{op:'verify',done:false,nextCursor:i,total:drafts.length,written:0,skipped:0,checked,conflicts};
    const d=drafts[i]!,{id4,service}=await loadService(d);
    const active=d.payload.active??(d.serviceId?service?.['active']===true:true);
    const probe=await port.inspectExistingRow(id4);
    if(!probe.present||JSON.stringify(probe.cells)!==JSON.stringify(expectedCells(d,active)))conflicts.push(id4);
    checked++;
    await ref.update({rescueVerifyCursor:i+1,updatedAt:new Date().toISOString()});
  }
  if(conflicts.length)throw Error('Sheet readback mismatch: '+conflicts.join(','));
  if(p['phase']==='sheet-write-in-flight'){
    await recordCatalogueSheetPhase(db,{id:input.publishId,tenantId:'automodz',phase:'sheet-verified',verifiedHashes:Object.fromEntries(reviews.map(r=>[r.draftId,r.reviewHash]))});
  }
  return{op:'verify',done:true,nextCursor:drafts.length,total:drafts.length,written:0,skipped:0,checked,conflicts};
}
