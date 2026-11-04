import {useState} from 'react';
import {View,Text} from 'react-native';
import {Button,colors,spacing} from '@autodeck/ui';
import type {ServiceJob} from '@autodeck/core';
import {hasReleasedBay} from '@autodeck/core';
import {releaseCompletedBay} from '../lib/studio-service';
// Parent keys this by job identity/status/release receipt so a stale confirmation
// cannot survive route or status changes. Backend rechecks actual state too.
export function ReleaseCompletedBayPane({job}:{job:ServiceJob}){
 const[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(job.status!=='READY_FOR_DELIVERY')return null;
 if(hasReleasedBay(job))return <Text style={{color:colors.textPrimary}}>Bay released. Pickup, payment and delivery checks still apply.</Text>;
 return <View style={{gap:spacing.md}}>{error?<Text accessibilityRole="alert" style={{color:colors.textPrimary}}>{error}</Text>:null}{confirm?<><Text style={{color:colors.textPrimary}}>Confirm all work is complete and the car has physically left this working bay. The remaining bay time becomes available now. This does not mark the car delivered or paid.</Text><Button label="Confirm work complete and bay empty" loading={busy} onPress={async()=>{setBusy(true);setError('');try{await releaseCompletedBay(job.id);setConfirm(false);}catch(e){setError(e instanceof Error?e.message:'Bay release failed. Reload before retrying.');}finally{setBusy(false);}}}/><Button label="Keep bay occupied" variant="secondary" disabled={busy} onPress={()=>setConfirm(false)}/></>:<Button label="Work complete and bay empty" variant="secondary" onPress={()=>setConfirm(true)}/>}</View>;
}
