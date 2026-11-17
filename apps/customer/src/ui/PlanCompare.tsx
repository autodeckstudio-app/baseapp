import { Pressable, Text, View } from 'react-native';
import { Icon, useExperienceTheme } from '@autodeck/ui/native';
import { discountLine, pickupsLine, type CompareCol } from '../lib/membership-view';
import { Chip, rupees } from './kit';

/** v17 structure only. Existing supplied records remain the sole price/benefit input. */
export function PlanCompare({cols,onOpen}:{cols:CompareCol[];onOpen:(planId:string)=>void}) {
 const {name}=useExperienceTheme();const dark=name==='night';
 const ink=dark?'#f0ece5':'#211f1a',muted=dark?'#a69e91':'#82796e',copper=dark?'#bb813f':'#bb6d32';
 const validRate=(c:CompareCol)=>Number.isFinite(c.price)&&c.price>0&&Number.isInteger(c.washes)&&c.washes>0&&c.perWash!==null&&Number.isFinite(c.perWash)&&c.perWash>0&&c.perWash===Math.round(c.price/c.washes);
 const rates=cols.filter(validRate).map(c=>c.perWash!);
 const best=rates.length===cols.length&&rates.length>1&&new Set(rates).size>1?Math.min(...rates):null;
 const text={fontFamily:'Inter, system-ui, sans-serif',color:ink};
 return <View style={{gap:14}}>{cols.map(c=>{
 const starter=/^starter$/i.test(c.name);const perks=[{icon:'wash' as const,text:`${c.washes} washes`},...(pickupsLine(c.pickups)?[{icon:'car' as const,text:pickupsLine(c.pickups)!}]:[]),...(c.priority?[{icon:'star' as const,text:'Priority slot'}]:[])];
 const serviceDiscount=discountLine(c.discount);
 return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${rupees(c.price)} per month`} onPress={()=>onOpen(c.id)} style={({pressed})=>({opacity:pressed?.85:1,backgroundColor:dark?'#24221d':'#ffffff',borderRadius:18,borderWidth:1,borderColor:c.current?copper:'transparent',paddingHorizontal:16,paddingVertical:23})}>
 <View style={{position:'relative'}}>
 <View style={{minWidth:0,gap:13}}>
 <Text style={[text,{fontSize:11,paddingRight:122,letterSpacing:3,fontWeight:'500',textTransform:'uppercase',color:copper}]}>{c.name}</Text>
 {c.current?<Text style={[text,{fontSize:10,color:copper}]}>Your plan</Text>:best!==null&&validRate(c)&&c.perWash===best?<Chip label="Best rate" tone="accent"/>:null}
 {perks.map((p,i)=><View key={p.text} style={{flexDirection:'row',alignItems:'center',gap:8,paddingRight:i===0?122:0}}><Icon mono name={p.icon} size={16} color={copper}/><Text style={[text,{flex:1,fontSize:13,lineHeight:20,color:i===0?ink:muted}]}>{p.text}</Text></View>)}
 {serviceDiscount?<Text style={[text,{fontSize:11,lineHeight:17,color:muted}]}>{serviceDiscount}</Text>:null}
 </View>
 <View style={{position:'absolute',right:0,top:0,alignItems:'flex-end',width:122,gap:5}}>
 <Text style={[text,{fontSize:23,lineHeight:32,letterSpacing:-.7,fontWeight:'400',textAlign:'right'}]}>{rupees(c.price)}<Text style={{fontSize:12,letterSpacing:0,color:muted}}> /month</Text></Text>
 {!starter&&c.perWash!==null?<Text style={[text,{fontSize:10,lineHeight:16,color:muted,textAlign:'right'}]}>{c.perWash%100!==0?'Approx. ':''}{rupees(Math.round(c.perWash/100)*100)}/wash</Text>:null}
 </View>
 </View>
 </Pressable>;
 })}</View>;
}
