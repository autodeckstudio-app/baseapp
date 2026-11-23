import { Text, View } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { jobTimeline } from './job-stage';
import { metrics } from '../lib/metrics';
import { raised } from '../lib/raised';
const date = (iso:string) => new Date(iso).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'});
const clock = (iso:string) => new Date(iso).toLocaleTimeString('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit'});
/** Same recorded stages and timestamps, arranged as a horizontal progress strip. */
export function JobTimeline({status,history,finalLabel}:{status:string;history:Array<{status:string;changedAt:string}>;finalLabel?:string|undefined}) {
 const {name,colors}=useExperienceTheme();const steps=jobTimeline(status,history);
 if(finalLabel)steps[3]={...steps[3]!,label:finalLabel,at:null};
 return <View style={{borderRadius:metrics.cardRadius,padding:metrics.cardPad,gap:16,...raised(name).card}}>
 <Text style={{color:colors.textTertiary,fontSize:12,fontWeight:'800',letterSpacing:1.2,textTransform:'uppercase'}}>Progress</Text>
 <View style={{flexDirection:'row'}}>{steps.map((s,i)=><View key={s.label} accessibilityLabel={`${s.label}, ${s.state}${s.at?`, ${date(s.at)}, ${clock(s.at)}`:''}`} style={{flex:1,minWidth:0,gap:7,alignItems:'center'}}>
 <View style={{height:18,width:'100%',justifyContent:'center',alignItems:'center'}}>{i>0?<View style={{position:'absolute',left:0,right:'50%',height:2,backgroundColor:s.state==='next'?colors.borderSubtle:colors.textPrimary}}/>:null}{i<3?<View style={{position:'absolute',left:'50%',right:0,height:2,backgroundColor:s.state==='done'?colors.textPrimary:colors.borderSubtle}}/>:null}<View style={{width:16,height:16,borderRadius:8,borderWidth:2,borderColor:s.state==='next'?colors.textTertiary:colors.textPrimary,backgroundColor:s.state==='next'?colors.surfaceElevated:colors.textPrimary}}/></View>
 <Text style={{color:s.state==='next'?colors.textTertiary:colors.textPrimary,fontSize:11,lineHeight:15,textAlign:'center',fontWeight:s.state==='now'?'800':'600',paddingHorizontal:2,minHeight:30}}>{s.label==='Ready status recorded'?'Ready recorded':s.label}</Text>
 {s.at?<View><Text style={{fontSize:10,lineHeight:14,textAlign:'center',color:colors.textSecondary}}>{date(s.at)}</Text><Text style={{fontSize:10,lineHeight:14,textAlign:'center',color:colors.textSecondary}}>{clock(s.at)}</Text></View>:null}
 </View>)}</View></View>;
}
