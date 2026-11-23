'use client';
import{useEffect,useRef,useState}from'react';
import type{Service}from'@autodeck/core';
import{saveCatalogueDraft,type CatalogueDraftView}from'../lib/catalogue-drafts';
import{checkPreparedCatalogue,type PreparedDraft}from'../lib/prepared-catalogue';
export function PreparedCatalogueImport({services,drafts,disabled,onStaged}:{services:Service[];drafts:CatalogueDraftView[];disabled:boolean;onStaged:(ids:string[])=>Promise<void>}){
 const[raw,setRaw]=useState<unknown>(null),[inputs,setInputs]=useState<PreparedDraft[]>([]),[message,setMessage]=useState(''),[running,setRunning]=useState(false);const alive=useRef(true),flight=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[]);
 async function stage(){if(disabled||flight.current||!raw)return;flight.current=true;setRunning(true);try{
  const checked=checkPreparedCatalogue(raw,services,drafts);const done=new Set(checked.existing.map(d=>d.id));let calls=0;
  for(const d of checked.inputs){if(!alive.current)return;if(done.has(d.draftId))continue;
   if(calls&&calls%48===0){setMessage(`${done.size} of ${checked.inputs.length} staged. Waiting for the request window; keep this tab open.`);await new Promise(r=>setTimeout(r,61000));if(!alive.current)return;}
   setMessage(`Staging ${done.size+1} of ${checked.inputs.length}. Nothing is live yet.`);await saveCatalogueDraft(d);done.add(d.draftId);calls++;
  }
  if(!alive.current)return;await onStaged(checked.inputs.map(d=>d.draftId));if(alive.current)setMessage(`${done.size} exact drafts staged. Review only this prepared batch below before publishing. Older drafts are unchanged.`);
 }catch{if(alive.current)setMessage('Staging stopped. Reload current drafts, then choose the same file to check and resume. Nothing was published by importing.');}finally{flight.current=false;if(alive.current)setRunning(false)}}
 return <details className="ax-panel" style={{marginTop:20}}><summary>Import prepared catalogue drafts</summary><p className="ax-sub">A prepared file stages drafts only. It does not publish or replace older drafts. Source versions are checked again by the server.</p><input aria-label="Prepared catalogue JSON" type="file" accept="application/json,.json" disabled={disabled||running} onChange={async e=>{const file=e.target.files?.[0];setRaw(null);setInputs([]);if(!file)return;try{if(file.size>1000000)throw Error();const value:unknown=JSON.parse(await file.text());const checked=checkPreparedCatalogue(value,services,drafts);if(!alive.current)return;setRaw(value);setInputs(checked.inputs);setMessage(`${checked.inputs.length} prepared changes; ${checked.existing.length} exact drafts already staged. Nothing is live yet.`);}catch{if(alive.current)setMessage('This file does not match the current service versions or prepared format. No draft was saved.');}}}/>{inputs.length?<p>{inputs.length} changes: {inputs.filter(d=>d.serviceId===null).length} new services, {inputs.filter(d=>d.payload.active===false).length} retirements. Existing job and payment records are not changed.</p>:null}<button type="button" className="ax-button" disabled={disabled||running||!inputs.length} onClick={()=>void stage()}>{running?'Staging drafts...':'Stage prepared drafts'}</button><p role="status">{message}</p></details>
}
