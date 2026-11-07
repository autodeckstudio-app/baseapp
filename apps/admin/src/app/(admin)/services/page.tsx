"use client";

import { useEffect, useState } from "react";
import type { Service } from "@autodeck/core";
import { ServicesView } from "../../../experience/ServicesView";
import type { ServicePayload } from "../../../experience/services-draft";
import {
  getServicesIncludingHidden,
} from "../../../lib/catalogue-service";

import {reviewManagedCatalogue,publishManagedCatalogue,getManagedCataloguePublishStatus,getCatalogueDrafts,saveCatalogueDraft,type CatalogueDraftView,type PublicCatalogueDestination}from '../../../lib/catalogue-drafts';
import {CatalogueReview}from '../../../experience/CatalogueReview';
import{useAdminAuth}from '../../../lib/auth-context';
import{CatalogueRecovery}from '../../../experience/CatalogueRecovery';
import{CataloguePublishInspector}from '../../../experience/CataloguePublishInspector';
import{draftFromService,toServicePayload}from '../../../experience/services-draft';

export default function ServiceCataloguePage(){const{user,claims}=useAdminAuth();if(!user||claims?.tenantId!=='automodz'||!['admin','superadmin'].includes(claims.role))return <p>Sign in with an authorized catalogue admin account.</p>;return <ServiceCatalogueScope key={user.uid+'|'+claims.tenantId+'|'+claims.role} principal={user.uid} tenantId={claims.tenantId}/>;}
export function ServiceCatalogueScope({principal,tenantId}:{principal:string;tenantId:string}) {
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
      await saveCatalogueDraft({...(selectedDraft?{draftId:selectedDraft.id}:{}),serviceId,expectedServiceUpdatedAt:selectedDraft?.expectedServiceUpdatedAt??source?.updatedAt??null,expectedDraftVersion:selectedDraft?.version??0,payload:{...payload,...(selectedDraft?.payload.active!==undefined?{active:selectedDraft.payload.active}:{})}});
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

  async function publish(draft:CatalogueDraftView){if(busy||!draft.reviewHash)return;const publishId='catalogue_'+draft.id+'_v'+draft.version;setBusy(true);setError(null);try{const result=await publishManagedCatalogue({publishId,reviews:[{draftId:draft.id,reviewHash:draft.reviewHash}]});if(result.phase!=='complete')throw Error('Not complete');setStatus('Published to the public catalogue and apps. Operation '+publishId);await refresh();}catch{setError('Publish not confirmed. Check operation '+publishId+' below. Do not retry or overwrite either destination.');await refresh();}finally{setBusy(false)}}
  return <><CatalogueRecovery/><CataloguePublishInspector principal={principal} tenantId={tenantId} onCheck={getManagedCataloguePublishStatus}/><ServicesView draftMode onOpenLive={()=>setEditing(null)} onCloseDraft={()=>setEditing(null)} incomingDraft={editing?{key:editing.id+editing.version,value:draftFromService({...services.find(s=>s.id===editing.serviceId),id:editing.serviceId as string,...editing.payload,vehicleCategoryPricing:editing.payload.vehicleCategoryPricing??[],requiredBayType:editing.payload.requiredBayType??'general',membershipWashEligible:editing.payload.membershipWashEligible??false,displayOrder:editing.payload.displayOrder??0}as Service)}:null} services={services} loading={loading} error={error} message={status} busy={busy} onSave={handleSave} onToggle={(svc) => void handleToggleActive(svc)} /><CatalogueReview drafts={drafts} publishedCount={publishedCount} busy={busy} onReview={review} onPublish={publish} onEdit={setEditing} onDestination={destination}/></>;
}
