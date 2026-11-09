"use client";
import{useEffect,useRef,useState}from'react';
import type{JobWorkCoverage,ServiceJob,WorkCommandScope,WorkRecordCommand}from'@autodeck/core';
import{useAdminAuth}from'../lib/auth-context';
import{createWorkCommandJournal}from'../lib/work-command-journal';
type Job=Pick<ServiceJob,'id'|'tenantId'|'studioId'|'vehicleId'|'customerId'>;
/** Lock performed-work evidence only. This does not deliver a car or issue coverage. */
export function LockJobWork({job,snapshot,onSaved}:{job:Job;snapshot:JobWorkCoverage;onSaved:()=>void}){
 const auth=useAdminAuth();const allowed=!auth.loading&&!!auth.user&&!!auth.claims&&['admin','superadmin'].includes(auth.claims.role)&&auth.claims.tenantId===job.tenantId;
 const scope:WorkCommandScope|null=allowed?{uid:auth.user!.uid,role:auth.claims!.role as 'admin'|'superadmin',tenantId:job.tenantId,studioId:auth.claims!.studioId,jobId:job.id,vehicleId:job.vehicleId,customerId:job.customerId}:null;
 const key=scope?JSON.stringify(scope):null;const active=useRef({key,epoch:0});if(active.current.key!==key)active.current={key,epoch:active.current.epoch+1};const epoch=active.current.epoch;const current=()=>!!key&&active.current.key===key&&active.current.epoch===epoch;
 const journal=scope?createWorkCommandJournal(scope,current):null;
 const[state,setState]=useState<{key:string|null;phase:'checking'|'ready'|'pending'|'blocked';pending:WorkRecordCommand|null}>({key:null,phase:'checking',pending:null});const[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false);const flight=useRef(false);
 useEffect(()=>{let alive=true;setState({key,phase:'checking',pending:null});setConfirmed(false);setBusy(false);if(journal)journal.restore().then(pending=>{if(alive&&current())setState({key,phase:pending?'pending':'ready',pending})}).catch(()=>{if(alive&&current())setState({key,phase:'blocked',pending:null})});return()=>{alive=false}},[key,snapshot.revision]);
 const ready=snapshot.status==='recorded'&&snapshot.workLock==='open'&&snapshot.revision!==null&&snapshot.items.length>0&&snapshot.items.every(i=>i.workStatus==='QC recorded');
 async function run(kind:'new'|'retry'|'check'){
  if(!journal||!current()||flight.current||kind==='new'&&(!ready||!confirmed))return;flight.current=true;setBusy(true);
  try{if(kind==='new'){const command:WorkRecordCommand={jobId:job.id,operationId:crypto.randomUUID(),expectedRevision:snapshot.revision!,action:'seal',confirmed:true};await journal.prepare(command);if(current())setState({key,phase:'pending',pending:command})}const receipt=kind==='check'?await journal.check():await journal.send();if(current()&&receipt){setState({key,phase:'checking',pending:null});onSaved()}}
  catch{if(current()){try{const pending=await journal.restore();if(current())setState({key,phase:pending?'pending':'blocked',pending})}catch{if(current())setState({key,phase:'blocked',pending:null})}}}finally{flight.current=false;if(current())setBusy(false)}
 }
 if(!allowed)return null;
 if(state.key!==key||state.phase==='checking')return<div role="status">Checking saved work...</div>;
 if(state.phase==='blocked')return<div role="status">Saved work needs review</div>;
 if(state.phase==='pending')return<div style={{display:'grid',gap:8}}><span>Submission not confirmed</span><div style={{display:'flex',gap:8}}><button type="button" className="ax-button" disabled={busy} onClick={()=>run('check')}>Check</button><button type="button" className="ax-button" disabled={busy} onClick={()=>run('retry')}>Retry same</button></div></div>;
 if(snapshot.workLock==='locked')return<div role="status">Work locked - coverage not confirmed</div>;
 if(!ready)return<div role="status">Record and check every work item before locking.</div>;
 return<div style={{display:'grid',gap:10,paddingTop:12}}><label style={{display:'flex',gap:10,alignItems:'center',minHeight:44}}><input style={{width:20,height:20,minHeight:20,padding:0,margin:0,flexShrink:0}} type="checkbox" disabled={busy} checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/><span>I checked the complete work record.</span></label><div><button type="button" className="ax-button" style={{minHeight:44}} disabled={!confirmed||busy} onClick={()=>run('new')}>Lock work</button></div><span style={{fontSize:12,opacity:.65}}>Work evidence only. Delivery and warranty checks stay separate.</span></div>;
}
