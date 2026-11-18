import{useEffect,useRef,useState}from'react';
import{Text,View}from'react-native';
import{httpsCallable}from'firebase/functions';
import type{ServiceJob}from'@autodeck/core';
import{functions}from'../lib/firebase';
import{onStaffAuthChanged,type StaffAuth}from'../lib/studio-service';
import{Button}from'@autodeck/ui';
import{colors}from'@autodeck/ui/tokens';
export function JobDelayControl({job}:{job:ServiceJob}){
 const[auth,setAuth]=useState<StaffAuth|null|undefined>(undefined);useEffect(()=>onStaffAuthChanged(setAuth),[]);
 const allowed=!!auth&&auth.tenantId===job.tenantId&&(['admin','superadmin'].includes(auth.role??'')||auth.role==='studio'&&auth.studioId===job.studioId);
 const scope=allowed?JSON.stringify([auth.uid,auth.role,auth.tenantId,auth.studioId,job.id,job.status,job.updatedAt]):null;const epoch=useRef({scope,generation:0});if(epoch.current.scope!==scope)epoch.current={scope,generation:epoch.current.generation+1};const identity=scope?scope+'@'+epoch.current.generation:null;const ref=useRef(identity);ref.current=identity;
 const[armed,setArmed]=useState<string|null>(null),[busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState<{scope:string|null;text:string}|null>(null);const lock=useRef<string|null>(null);
 async function send(){if(!identity||armed!==identity||lock.current===identity||ref.current!==identity)return;const key=identity;lock.current=key;setBusy(key);setMessage(null);try{await httpsCallable(functions,'reportJobDelay')({jobId:job.id,expectedUpdatedAt:job.updatedAt});if(ref.current===key){setArmed(null);setMessage({scope:key,text:'Delay reported. The customer alert is queued.'})}}catch{if(ref.current===key)setMessage({scope:key,text:'Delay not confirmed. Reload this job before another attempt.'})}finally{if(lock.current===key)lock.current=null;if(ref.current===key)setBusy(null)}}
 if(!allowed)return null;if(job.delayReported)return<Text style={{color:colors.textSecondary}}>Delay reported to the customer</Text>;
 if(!['VEHICLE_RECEIVED','IN_PROGRESS','QUALITY_CHECK'].includes(job.status))return null;
 return<View style={{gap:10,padding:16}}><Text style={{color:colors.textPrimary}}>Customer delay update</Text><Text style={{color:colors.textSecondary}}>Only report a real delay. This sends one customer alert. Booking time and price stay unchanged.</Text>{message?.scope===identity?<Text style={{color:colors.textPrimary}}>{message.text}</Text>:null}{armed===identity?<><Text style={{color:colors.textPrimary}}>Tell the customer this service is taking longer than planned?</Text><Button label="Send delay alert" loading={busy===identity} onPress={()=>void send()}/><Button label="Cancel" variant="secondary" disabled={busy===identity} onPress={()=>setArmed(null)}/></>:<Button label="Report delay" variant="secondary" onPress={()=>setArmed(identity)}/>}</View>;
}
