'use client';
import{useRef,useState}from'react';
import{httpsCallable}from'firebase/functions';
import type{ServiceJob}from'@autodeck/core';
import{functions}from'../lib/firebase';
import{useAdminAuth}from'../lib/auth-context';
export function JobDelayControl({job}:{job:ServiceJob}){
 const{user,claims,loading}=useAdminAuth();const allowed=!loading&&!!user&&claims?.tenantId===job.tenantId&&['admin','superadmin'].includes(claims.role);
 const scope=allowed?JSON.stringify([user.uid,claims?.role,claims?.tenantId,job.id,job.status,job.updatedAt]):null;const epoch=useRef({scope,generation:0});if(epoch.current.scope!==scope)epoch.current={scope,generation:epoch.current.generation+1};const identity=scope?scope+'@'+epoch.current.generation:null;const ref=useRef(identity);ref.current=identity;
 const[armed,setArmed]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState<{scope:string|null;text:string}|null>(null);const lock=useRef<string|null>(null);
 async function send(){if(!identity||armed!==identity||lock.current===identity||ref.current!==identity)return;const key=identity;lock.current=key;setBusy(key);setMessage(null);try{await httpsCallable(functions,'reportJobDelay')({jobId:job.id,expectedUpdatedAt:job.updatedAt});if(ref.current===key){setArmed(null);setMessage({scope:key,text:'Delay reported. The customer alert is queued.'})}}catch{if(ref.current===key)setMessage({scope:key,text:'Delay not confirmed. Reload this job before another attempt.'})}finally{if(lock.current===key)lock.current=null;if(ref.current===key)setBusy(null)}}
 if(!allowed)return null;if(job.delayReported)return<p role="status" className="ax-note">Delay reported to the customer</p>;
 if(!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK'].includes(job.status))return null;
 return<section className="ax-panel"><p className="ax-label">Customer delay update</p><p className="ax-note">Only report a real delay. This sends one alert to the customer and does not change the booking time or price.</p>{message?.scope===identity?<p role="status">{message.text}</p>:null}{armed===identity?<><p>Tell the customer this service is taking longer than planned?</p><button type="button" className="ax-button" disabled={busy===identity} onClick={()=>void send()}>Send delay alert</button><button type="button" className="ax-button" disabled={busy===identity} onClick={()=>setArmed(null)}>Cancel</button></>:<button type="button" className="ax-button" onClick={()=>setArmed(identity)}>Report delay</button>}</section>;
}
