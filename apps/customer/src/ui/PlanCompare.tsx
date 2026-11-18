import { Pressable, Text, View } from 'react-native';
import { Icon, useExperienceTheme } from '@autodeck/ui/native';
import { discountLine, pickupsLine, type CompareCol } from '../lib/membership-view';
import { Chip, rupees } from './kit';

/** v17 structure only. Existing supplied records remain the sole price/benefit input. */
export function PlanCompare({cols,onOpen}:{cols:CompareCol[];onOpen:(planId:string)=>void}) {
 const {name,colors}=useExperienceTheme();const dark=name==='night';
 const ink=colors.textPrimary,muted=colors.textSecondary,copper=colors.textTertiary;
 const validRate=(c:CompareCol)=>Number.isFinite(c.price)&&c.price>0&&Number.isInteger(c.washes)&&c.washes>0&&c.perWash!==null&&Number.isFinite(c.perWash)&&c.perWash>0&&c.perWash===Math.round(c.price/c.washes);
 const rates=cols.filter(validRate).map(c=>c.perWash!);
 const best=rates.length===cols.length&&rates.length>1&&new Set(rates).size>1?Math.min(...rates):null;
 const text={fontFamily:'Inter, system-ui, sans-serif',color:ink};
 return <View style={{gap:14}}>{cols.map(c=>{
 const starter=/^starter$/i.test(c.name);const perks=[{icon:'wash' as const,text:`${c.washes} washes`},...(pickupsLine(c.pickups)?[{icon:'car' as const,text:pickupsLine(c.pickups)!}]:[]),...(c.priority?[{icon:'star' as const,text:'Priority slot'}]:[])];
 const serviceDiscount=discountLine(c.discount);
 return <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${rupees(c.price)} per month`} onPress={()=>onOpen(c.id)} style={({pressed})=>({opacity:pressed?.85:1,backgroundColor:dark?'#233246':'#F8FAFD',borderRadius:28,borderWidth:1,borderColor:c.current?colors.textPrimary:colors.borderSubtle,paddingHorizontal:22,paddingVertical:24})}>
 <View style={{gap:22}}>
 <View style={{minWidth:0,gap:13}}>
 <Text style={[text,{fontSize:17,letterSpacing:.2,fontWeight:'700',textTransform:'uppercase',color:copper}]}>{c.name}</Text>
 {c.current?<Text style={[text,{fontSize:10,color:copper}]}>Your plan</Text>:best!==null&&validRate(c)&&c.perWash===best?<Chip label="Best rate" tone="accent"/>:null}
 {perks.map((p,i)=><View key={p.text} style={{flexDirection:'row',alignItems:'center',gap:8,paddingRight:0}}><Icon mono name={p.icon} size={16} color={copper}/><Text style={[text,{flex:1,fontSize:13,lineHeight:20,color:i===0?ink:muted}]}>{p.text}</Text></View>)}
 {serviceDiscount?<Text style={[text,{fontSize:11,lineHeight:17,color:muted}]}>{serviceDiscount}</Text>:null}
 </View>
 <View style={{borderTopWidth:1,borderTopColor:colors.borderSubtle,paddingTop:18,flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
 <Text style={[text,{fontSize:30,lineHeight:38,letterSpacing:-.7,fontWeight:'700'}]}>{rupees(c.price)}<Text style={{fontSize:12,letterSpacing:0,color:muted}}> /month</Text></Text>
 {!starter&&c.perWash!==null?<Text style={[text,{fontSize:10,lineHeight:16,color:muted,textAlign:'right'}]}>{c.perWash%100!==0?'Approx. ':''}{rupees(Math.round(c.perWash/100)*100)}/wash</Text>:null}
 <Text style={[text,{fontSize:12,fontWeight:'700'}]}>View plan</Text></View>
 </View>
 </Pressable>;
 })}</View>;
}
