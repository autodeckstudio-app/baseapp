"use client";

import { useEffect, useState, useRef } from "react";
import type { Service } from "@autodeck/core";
import { ServicesView } from "../../../experience/ServicesView";
import type { ServicePayload } from "../../../experience/services-draft";
import {
  getServicesIncludingHidden,
} from "../../../lib/catalogue-service";

import {readCustomerPublication,reviewManagedCatalogueBatch,reviewManagedCatalogue,publishManagedCatalogue,getManagedCataloguePublishStatus,getCatalogueDrafts,saveCatalogueDraft,discardCatalogueDraft,type CatalogueDraftView,type PublicCatalogueDestination}from '../../../lib/catalogue-drafts';
import {CatalogueReview}from '../../../experience/CatalogueReview';
import{publishReviewedSelection,publishSelectionProblem}from '../../../experience/catalogue-publish-review';
import{useAdminAuth}from '../../../lib/auth-context';
import{CatalogueRecovery}from '../../../experience/CatalogueRecovery';
import{CataloguePublishInspector}from '../../../experience/CataloguePublishInspector';
import{draftFromService,toServicePayload}from '../../../experience/services-draft';

export default function ServiceCataloguePage(){const{user,claims}=useAdminAuth();if(!user||claims?.tenantId!=='automodz'||!['admin','superadmin'].includes(claims.role))return <p>Sign in with an authorized catalogue admin account.</p>;return <ServiceCatalogueScope key={user.uid+'|'+claims.tenantId+'|'+claims.role} principal={user.uid} tenantId={claims.tenantId}/>;}
export function ServiceCatalogueScope({principal,tenantId}:{principal:string;tenantId:string}) {
  const[unconfirmedOperation,setUnconfirmedOperation]=useState<string|null>(null);
  const publishFlight=useRef(false);
  const[trackingReady,setTrackingReady]=useState(false);
  const operationKey='autodeck.catalogue.publish.'+tenantId+'.'+principal;
  useEffect(()=>{try{setUnconfirmedOperation(localStorage.getItem(operationKey));setTrackingReady(true)}catch{setError('Safe publish tracking is unavailable on this device.')}},[operationKey]);
  const[editing,setEditing]=useState<CatalogueDraftView|null>(null);
  const[drafts,setDrafts]=useState<CatalogueDraftView[]>([]);
  const[publishedCount,setPublishedCount]=useState(0);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [list,reviewData] = await Promise.all([getServicesIncludingHidden(),getCatalogueDrafts()]);
      setDrafts(reviewData.drafts);
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
      const selectedDraft=editing&&editing.serviceId===serviceId?editing:null;
      const source=serviceId?services.find(s=>s.id===serviceId):null;
      if(serviceId&&!source)throw Error('Source service missing');
      await saveCatalogueDraft({...(selectedDraft?{draftId:selectedDraft.id}:{}),serviceId,expectedServiceUpdatedAt:selectedDraft?.expectedServiceUpdatedAt??source?.updatedAt??null,expectedDraftVersion:selectedDraft?.version??0,publicDestination:payload.customerMenu?({paint:payload.customerMenu.family==='Ceramic'?'Ceramic':'Paint Protection',detailing:'Coatings',washing:'Wash and care',garage:'Garage',modifications:'Modifications and wraps'}as const)[payload.customerMenu.home]:selectedDraft?.publicDestination??null,payload:{...payload,...(selectedDraft?.payload.active!==undefined?{active:selectedDraft.payload.active}:{})}});
      setEditing(null);
      setStatus(`${payload.name} saved as a draft. Nothing is live yet.`);
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
      const converted=toServicePayload(draftFromService(svc));if(!converted.ok)throw Error(converted.problem);
      await saveCatalogueDraft({serviceId:svc.id,expectedServiceUpdatedAt:svc.updatedAt,expectedDraftVersion:0,payload:{...converted.payload,active:!svc.active}});
      setStatus(`${svc.name}: visibility change saved as a draft. The live menu has not changed.`);
      await refresh();
    } catch {
      setError("Couldn't change the service.");
    } finally {
      setBusy(false);
    }
  }

  async function destination(draft:CatalogueDraftView,publicDestination:PublicCatalogueDestination){setBusy(true);setError(null);try{await saveCatalogueDraft({draftId:draft.id,serviceId:draft.serviceId,expectedServiceUpdatedAt:draft.expectedServiceUpdatedAt,expectedDraftVersion:draft.version,publicDestination,payload:draft.payload});await refresh();setStatus('Public destination saved. Review the new draft version.');}catch{setError('Could not save the destination. Reload the latest draft.');}finally{setBusy(false)}}
  async function review(draft:CatalogueDraftView){setBusy(true);setError(null);try{await reviewManagedCatalogue({draftId:draft.id,expectedVersion:draft.version});await refresh();setStatus("Exact version marked reviewed. It has not been published.");}catch{setError("Could not review this version. Reload and check for changes.");}finally{setBusy(false)}}

  async function discard(draft:CatalogueDraftView){if(busy||loading||error)return;setBusy(true);setError(null);try{await discardCatalogueDraft({draftId:draft.id,expectedVersion:draft.version});setStatus('Draft discarded. The live service and past bookings were not affected.');await refresh();}catch{setError('Draft was not discarded. Reload and try again.');await refresh();}finally{setBusy(false)}}
  async function reviewAndPublish(chosen:CatalogueDraftView[]):Promise<boolean>{
    if(!trackingReady||busy||loading||error||publishFlight.current||unconfirmedOperation||drafts.some(d=>['publishing','blocked'].includes(d.state)))return false;
    chosen=[...chosen].sort((a,b)=>a.id.localeCompare(b.id));
    const problem=publishSelectionProblem(chosen,services);if(problem){setError(problem);return false;}
    publishFlight.current=true;setBusy(true);setError(null);setStatus(null);let started=false;let publishId='';
    try{
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(chosen.map(d=>d.id+':'+d.version).sort().join('|')));
      publishId='catalogue_'+Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,40);
      await publishReviewedSelection(chosen,{publishId,drafts:async()=>(await getCatalogueDrafts()).drafts,review:d=>reviewManagedCatalogue({draftId:d.id,expectedVersion:d.version}),reviewBatch:reviewManagedCatalogueBatch,publish:(id,reviews)=>publishManagedCatalogue({publishId:id,reviews}),status:getManagedCataloguePublishStatus,customerCatalogue:readCustomerPublication,services:getServicesIncludingHidden,onPublishStarted:()=>{localStorage.setItem(operationKey,publishId);started=true;setUnconfirmedOperation(publishId)}});
      localStorage.removeItem(operationKey);setUnconfirmedOperation(null);await refresh();setStatus('Live. Customer and website catalogue data were checked and match these changes.');return true;
    }catch{
      if(started)setUnconfirmedOperation(publishId);
      await refresh();setError(started?'Publishing needs a status check. Do not publish again yet.':'These changes could not be validated. Nothing was published. Reload and review them again.');return false;
    }finally{publishFlight.current=false;setBusy(false)}
  }
  const heldDraft=drafts.find(d=>d.state==='publishing'||d.state==='blocked');
  const recoveryId=unconfirmedOperation;const recoveryNeeded=Boolean(recoveryId||heldDraft);
  return <>{recoveryNeeded?<p role="alert" className="ax-status-msg ax-status-msg--warn">Publishing needs a check. Open Publishing help below before another publish.</p>:null}<ServicesView draftMode onOpenLive={()=>setEditing(null)} onCloseDraft={()=>setEditing(null)} incomingDraft={editing?{key:editing.id+editing.version,value:draftFromService({...services.find(s=>s.id===editing.serviceId),id:editing.serviceId as string,...editing.payload,vehicleCategoryPricing:editing.payload.vehicleCategoryPricing??[],requiredBayType:editing.payload.requiredBayType??'general',membershipWashEligible:editing.payload.membershipWashEligible??false,displayOrder:editing.payload.displayOrder??0}as Service)}:null} services={services} loading={loading} error={error} message={status} busy={busy} onSave={handleSave} onToggle={(svc) => void handleToggleActive(svc)} /><CatalogueReview drafts={drafts} publishedCount={publishedCount} error={error} busy={!trackingReady||busy||loading||Boolean(error)||recoveryNeeded} services={services} onReviewAndPublish={reviewAndPublish} onEdit={setEditing} onDestination={destination} onDiscard={discard}/><details className="ax-panel ax-publishing-help" open={recoveryNeeded}><summary>Publishing help</summary><p className="ax-note">Only needed if a publish was not confirmed. Checking status does not publish again.</p><CataloguePublishInspector key={'inspect-'+recoveryId} initialOperationId={recoveryId??''} principal={principal} tenantId={tenantId} onCheck={async id=>{const result=await getManagedCataloguePublishStatus(id);if(result.phase==='complete'){const publicReadback=await readCustomerPublication();if(result.publishId!==id||!result.customerPublication||publicReadback.publishId!==id||publicReadback.hash!==result.customerPublication.hash)throw Error('Customer and website publication could not be checked. The pending operation is retained.');localStorage.removeItem(operationKey);setUnconfirmedOperation(null);await refresh()}return result}}/><details><summary>Recovery review</summary><CatalogueRecovery key={'recover-'+recoveryId} initialOperationId={recoveryId??''}/></details></details></>;
}
