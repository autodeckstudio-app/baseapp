'use client';
import{useRef,useState}from'react';
import{httpsCallable}from'firebase/functions';
import type{ServiceJob}from'@autodeck/core';
import{functions}from'../lib/firebase';
import{useAdminAuth}from'../lib/auth-context';
export function JobDelayControl({job}:{job:ServiceJob}){
 const{user,claims,loading}=useAdminAuth();const allowed=!loading&&!!user&&claims?.tenantId===job.tenantId&&['admin','superadmin'].includes(claims.role);
 const scope=allowed?JSON.stringify([user.uid,claims?.role,claims?.tenantId,job.id,job.status,job.updatedAt]):null;const ref=useRef(scope);ref.current=scope;
 const[armed,setArmed]=useState<string|null>(null),[busy,setBusy]=useState(false),[message,setMessage]=useState<{scope:string|null;text:string}|null>(null);const lock=useRef(false);
 async function send(){if(!scope||armed!==scope||lock.current||ref.current!==scope)return;const key=scope;lock.current=true;setBusy(true);setMessage(null);try{await httpsCallable(functions,'reportJobDelay')({jobId:job.id,expectedUpdatedAt:job.updatedAt});if(ref.current===key){setArmed(null);setMessage({scope:key,text:'Delay reported. The customer alert is queued.'})}}catch{if(ref.current===key)setMessage({scope:key,text:'Delay not confirmed. Reload this job before another attempt.'})}finally{lock.current=false;if(ref.current===key)setBusy(false)}}
 if(!allowed)return null;if(job.delayReported)return<p role="status" className="ax-note">Delay reported to the customer</p>;
 if(!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK'].includes(job.status))return null;
 return<section className="ax-panel"><p className="ax-label">Customer delay update</p><p className="ax-note">Only report a real delay. This sends one alert to the customer and does not change the booking time or price.</p>{message?.scope===scope?<p role="status">{message.text}</p>:null}{armed===scope?<><p>Tell the customer this service is taking longer than planned?</p><button type="button" className="ax-button" disabled={busy} onClick={()=>void send()}>Send delay alert</button><button type="button" className="ax-button" disabled={busy} onClick={()=>setArmed(null)}>Cancel</button></>:<button type="button" className="ax-button" onClick={()=>setArmed(scope)}>Report delay</button>}</section>;
}
