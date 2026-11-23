"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import type { Service } from "@autodeck/core";
import {PreparedCatalogueImport}from'../../../experience/PreparedCatalogueImport';
import { ServicesView } from "../../../experience/ServicesView";
import type { ServicePayload } from "../../../experience/services-draft";
import {
  getServicesIncludingHidden,
} from "../../../lib/catalogue-service";

import {readCustomerPublication,reviewManagedCatalogueBatch,reviewManagedCatalogue,publishManagedCatalogue,getManagedCataloguePublishStatus,getCatalogueDrafts,saveCatalogueDraft,discardCatalogueDraft,type CatalogueDraftView}from '../../../lib/catalogue-drafts';
import type{SourcePricePreparedReview}from'../../../experience/SourcePriceReview';
// Enabled after exact source-writer, mapping and rollout approval.
const PRICE_SOURCE_REVIEW_READY=true;
import {CatalogueReview}from '../../../experience/CatalogueReview';
import{canonicalDraftSelection,publishReviewedSelection,publishSelectionProblem}from '../../../experience/catalogue-publish-review';
import{useAdminAuth}from '../../../lib/auth-context';
import{CatalogueRecovery}from '../../../experience/CatalogueRecovery';
import{CataloguePublishInspector}from '../../../experience/CataloguePublishInspector';
import{preserveUneditedServiceFields}from '../../../experience/service-edit-preservation';
import{draftFromService,toServicePayload}from '../../../experience/services-draft';

export default function ServiceCataloguePage(){const{user,claims}=useAdminAuth();if(!user||claims?.tenantId!=='automodz'||!['admin','superadmin'].includes(claims.role))return <p>Sign in with an authorized catalogue admin account.</p>;return <ServiceCatalogueScope key={user.uid+'|'+claims.tenantId+'|'+claims.role} principal={user.uid} tenantId={claims.tenantId}/>;}
export function ServiceCatalogueScope({principal,tenantId}:{principal:string;tenantId:string}) {
  const[unconfirmedOperation,setUnconfirmedOperation]=useState<string|null>(null);
  const publishFlight=useRef(false);
  const mounted=useRef(true),statusFlight=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  const[trackingReady,setTrackingReady]=useState(false);
  const operationKey='autodeck.catalogue.publish.'+tenantId+'.'+principal;
  const selectionKey='autodeck.catalogue.draft-selection.'+tenantId+'.'+principal;
  useEffect(()=>{try{setUnconfirmedOperation(localStorage.getItem(operationKey));const saved=JSON.parse(localStorage.getItem(selectionKey)??'[]');setRecentIds(Array.isArray(saved)?saved.filter((id:unknown)=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(id)).slice(0,100):[]);setTrackingReady(true)}catch{setError('Safe publish tracking is unavailable on this device.')}},[operationKey,selectionKey]);
  const[editing,setEditing]=useState<CatalogueDraftView|null>(null);
  const[preparedIds,setPreparedIds]=useState<string[]>([]);
  const[recentIds,setRecentIds]=useState<string[]>([]);
  const[sharedDraftIds,setSharedDraftIds]=useState<string[]>([]);
  const[drafts,setDrafts]=useState<CatalogueDraftView[]>([]);
  const[publishedCount,setPublishedCount]=useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function rememberRecent(ids:string[]){setRecentIds(ids);try{localStorage.setItem(selectionKey,JSON.stringify(ids))}catch{/* Saved drafts remain recoverable individually; never infer selection from the feed. */}}

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [list,reviewData] = await Promise.all([getServicesIncludingHidden(),getCatalogueDrafts()]);
      setDrafts(reviewData.drafts);setSharedDraftIds(reviewData.sharedDraftIds??[]);
      setPublishedCount(reviewData.publishedCount);
      list.sort((a, b) => a.displayOrder - b.displayOrder);
      setServices(list);
    } catch {
      setError("Couldn't load services.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // The callables re-validate and re-check the admin role server-side.
  async function handleSave(serviceId: string | null, payload: ServicePayload):Promise<boolean> {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const selectedDraft=editing&&editing.serviceId===serviceId?editing:serviceId?drafts.find(d=>(recentIds.includes(d.id)||sharedDraftIds.includes(d.id))&&d.serviceId===serviceId&&['draft','reviewed'].includes(d.state))??null:null;
      const source=serviceId?services.find(s=>s.id===serviceId):null;
      if(serviceId&&!source)throw Error('Source service missing');
      if(source)payload=preserveUneditedServiceFields(payload,selectedDraft?{...source,...selectedDraft.payload}:source);
      const saved=await saveCatalogueDraft({...(selectedDraft?{draftId:selectedDraft.id}:{}),serviceId,expectedServiceUpdatedAt:selectedDraft?.expectedServiceUpdatedAt??source?.updatedAt??null,expectedDraftVersion:selectedDraft?.version??0,publicDestination:payload.customerMenu?({paint:payload.customerMenu.family==='Ceramic'?'Ceramic':'Paint Protection',detailing:'Coatings',washing:'Wash and care',garage:'Garage',modifications:'Modifications and wraps'}as const)[payload.customerMenu.home]:selectedDraft?.publicDestination??null,payload:{...payload,...(selectedDraft?.payload.active!==undefined?{active:selectedDraft.payload.active}:{})}});
      rememberRecent([...new Set([...recentIds,saved.id])]);
      setEditing(null);
      setStatus(`${payload.name} saved. Review and publish when ready.`);
      await refresh();
      return true;
    } catch {
      setError("Couldn't save the draft. Your entered details are still open.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(svc: Service) {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const selected=drafts.find(d=>(recentIds.includes(d.id)||sharedDraftIds.includes(d.id))&&d.serviceId===svc.id&&['draft','reviewed'].includes(d.state));
      const base=selected?{...svc,...selected.payload}:svc;const converted=toServicePayload(draftFromService(base));if(!converted.ok)throw Error(converted.problem);
      const saved=await saveCatalogueDraft({...(selected?{draftId:selected.id}:{}),serviceId:svc.id,expectedServiceUpdatedAt:selected?.expectedServiceUpdatedAt??svc.updatedAt,expectedDraftVersion:selected?.version??0,payload:{...preserveUneditedServiceFields(converted.payload,base),active:!svc.active}});
      rememberRecent([...new Set([...recentIds,saved.id])]);
      setStatus(`${svc.name}: visibility change saved as a draft. The live menu has not changed.`);
      await refresh();
    } catch {
      setError("Couldn't change the service.");
    } finally {
      setBusy(false);
    }
  }

  async function discard(draft:CatalogueDraftView){if(busy||loading||error)return;setBusy(true);setError(null);try{await discardCatalogueDraft({draftId:draft.id,expectedVersion:draft.version});setStatus('Draft discarded. The live service and past bookings were not affected.');await refresh();}catch{setError('Draft was not discarded. Reload and try again.');await refresh();}finally{setBusy(false)}}
  const prepareSourceReview=useCallback(async(chosen:CatalogueDraftView[]):Promise<SourcePricePreparedReview>=>{const r=await reviewManagedCatalogueBatch(canonicalDraftSelection(chosen));if(!r.sourceReview)throw Error('Actual source review unavailable');return{...r.sourceReview,reviews:r.drafts.map(d=>({draftId:d.id,reviewHash:d.reviewHash}))};},[]);
  async function reviewAndPublish(chosen:CatalogueDraftView[],sourceReview?:SourcePricePreparedReview):Promise<boolean>{
    if(PRICE_SOURCE_REVIEW_READY&&!sourceReview){setError('Check the actual sheet prices before publishing.');return false;}
    if(!trackingReady||busy||loading||error||publishFlight.current||unconfirmedOperation||drafts.some(d=>['publishing','blocked'].includes(d.state)))return false;
    chosen=canonicalDraftSelection(chosen);
    const problem=publishSelectionProblem(chosen,services);if(problem){setError(problem);return false;}
    publishFlight.current=true;setBusy(true);setError(null);setStatus(null);let started=false;let publishId='';
    try{
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(chosen.map(d=>d.id+':'+d.version).sort().join('|')));
      publishId='catalogue_'+Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,40);
      await publishReviewedSelection(chosen,{publishId,drafts:async()=>(await getCatalogueDrafts()).drafts,review:d=>reviewManagedCatalogue({draftId:d.id,expectedVersion:d.version}),reviewBatch:reviewManagedCatalogueBatch,...(sourceReview?{preparedReviews:sourceReview.reviews}:{}),publish:(id,reviews)=>publishManagedCatalogue({publishId:id,reviews,...(sourceReview?{sourceReview:{id:sourceReview.id,hash:sourceReview.hash},noSheetEdits:true as const}:{})}),status:getManagedCataloguePublishStatus,customerCatalogue:readCustomerPublication,services:getServicesIncludingHidden,onPublishStarted:()=>{localStorage.setItem(operationKey,publishId);started=true;setUnconfirmedOperation(publishId)}});
      localStorage.removeItem(operationKey);setUnconfirmedOperation(null);await refresh();rememberRecent(recentIds.filter(id=>!chosen.some(d=>d.id===id)));setStatus('Published. Your menu is up to date.');return true;
    }catch{
      if(started)setUnconfirmedOperation(publishId);
      await refresh();setError(started?'Publishing needs a status check. Do not publish again yet.':'These changes could not be validated. Nothing was published. Reload and review them again.');return false;
    }finally{publishFlight.current=false;setBusy(false)}
  }
  async function checkPending(id:string){if(statusFlight.current)throw Error('Check already running');statusFlight.current=true;setBusy(true);try{const result=await getManagedCataloguePublishStatus(id);if(!mounted.current)throw Error('Scope changed');if(result.phase==='complete'){const readback=await readCustomerPublication();if(!mounted.current)throw Error('Scope changed');if(result.publishId!==id||!result.customerPublication||readback.publishId!==id||readback.hash!==result.customerPublication.hash)throw Error('Unconfirmed');localStorage.removeItem(operationKey);setUnconfirmedOperation(null);await refresh();setStatus('Published. Your menu is up to date.');setError(null)}else setError('Your last publish is still being checked. No second publish was started.');return result}catch{if(mounted.current)setError('Could not confirm the last publish yet. Your changes are protected.');throw Error('Unconfirmed')}finally{statusFlight.current=false;if(mounted.current)setBusy(false)}}
  const heldDraft=drafts.find(d=>d.state==='publishing'||d.state==='blocked');
  const recoveryId=unconfirmedOperation;const recoveryNeeded=Boolean(recoveryId||heldDraft);
  return <>

 <ServicesView draftMode onOpenLive={svc=>{const existing=svc?drafts.find(d=>(recentIds.includes(d.id)||sharedDraftIds.includes(d.id))&&d.serviceId===svc.id&&['draft','reviewed'].includes(d.state)):null;setEditing(existing??null);return Boolean(existing)}} onCloseDraft={()=>setEditing(null)} incomingDraft={editing?{key:editing.id+editing.version,value:draftFromService({...services.find(s=>s.id===editing.serviceId),id:editing.serviceId as string,...editing.payload,vehicleCategoryPricing:editing.payload.vehicleCategoryPricing??[],requiredBayType:editing.payload.requiredBayType??'general',membershipWashEligible:editing.payload.membershipWashEligible??false,displayOrder:editing.payload.displayOrder??0}as Service)}:null} services={services} loading={loading} error={recoveryNeeded?null:error} message={status} busy={busy||recoveryNeeded} onSave={handleSave} onToggle={(svc)=>void handleToggleActive(svc)}/>
 {recoveryNeeded?<section className="ax-publish-strip" role="status"><div><strong>Publish not confirmed</strong><p>Your changes are protected. Don't publish again yet.</p></div>{recoveryId?<button className="ax-button" disabled={busy} onClick={()=>void checkPending(recoveryId).catch(()=>{})}>Check status</button>:null}</section>:null}
 <CatalogueReview drafts={drafts} blocked={recoveryNeeded} primaryIds={[...recentIds,...preparedIds]} publishedCount={publishedCount} services={services} busy={!trackingReady||busy||loading||Boolean(error)||recoveryNeeded} error={error} onReviewAndPublish={reviewAndPublish} {...(PRICE_SOURCE_REVIEW_READY?{onPrepareSourceReview:prepareSourceReview}:{})} onEdit={setEditing} onDiscard={discard}/>
 <details className="ax-catalogue-tools"><summary>Catalogue tools</summary><PreparedCatalogueImport services={services} drafts={drafts} disabled={busy||loading||Boolean(error)||recoveryNeeded} onStaged={async ids=>{setPreparedIds(ids);rememberRecent([...new Set([...recentIds,...ids])]);await refresh()}}/>{recoveryNeeded?<details className="ax-panel ax-publishing-help"><summary>Publishing help</summary><CataloguePublishInspector key={'inspect-'+recoveryId} initialOperationId={recoveryId??''} principal={principal} tenantId={tenantId} onCheck={checkPending}/><details><summary>Recovery review</summary><CatalogueRecovery key={'recover-'+recoveryId} initialOperationId={recoveryId??''}/></details></details>:null}</details>
 </>;
}
