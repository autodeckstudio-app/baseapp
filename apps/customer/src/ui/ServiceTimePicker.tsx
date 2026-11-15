import {useEffect,useState} from 'react';
import {Pressable,ScrollView,View} from 'react-native';
import type {AvailableSlot} from '../lib/booking-service';
import {T} from './kit';
import {useExperienceTheme} from '@autodeck/ui/native';
export function slotDaypart(time:string){const hour=Number(time.split(':')[0]);return hour<12?'Morning':hour<17?'Afternoon':'Evening'}
/** Dates and times come only from returned availability. Dayparts organize, never create slots. */
export function ServiceTimePicker({slots,picked,onPick,initialDate,onDayChange}:{slots:AvailableSlot[];picked:AvailableSlot|null;onPick:(slot:AvailableSlot)=>void;initialDate?:string|null|undefined;onDayChange?:((date:string)=>void)|undefined}){
 const{colors,name}=useExperienceTheme();
 const dates=[...new Set(slots.map(s=>s.date))].sort();const[day,setDay]=useState<string|null>(initialDate??null);
 useEffect(()=>{setDay(old=>old&&dates.includes(old)?old:dates[0]??null)},[dates.join('|')]);
 const active=day&&dates.includes(day)?day:dates[0];
 return <View style={{gap:12}}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{dates.map(date=><Pressable key={date} accessibilityRole="button" accessibilityLabel={`Choose ${date}`} accessibilityState={{selected:active===date}} onPress={()=>{setDay(date);onDayChange?.(date)}} style={{minHeight:48,justifyContent:'center',paddingHorizontal:14,borderRadius:14,borderWidth:1,borderColor:active===date?colors.accent:colors.borderSubtle,backgroundColor:active===date?colors.accentHaze:'transparent'}}><T role="caption" tone={active===date?'accent':'secondary'}>{new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',weekday:'short'})}</T><T role="bodyStrong">{new Date(`${date}T12:00:00Z`).toLocaleDateString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short'})}</T></Pressable>)}</ScrollView><T role="label" tone="tertiary">Then choose a time</T>{['Morning','Afternoon','Evening'].map(part=>{const times=slots.filter(s=>s.date===active&&slotDaypart(s.startTime)===part);return times.length?<View key={part} style={{gap:8}}><T role="bodyStrong">{part}</T><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{times.map(s=>{const on=picked?.startAt===s.startAt;return <Pressable key={s.startAt} accessibilityRole="button" accessibilityLabel={`Time ${s.startTime}`} accessibilityState={{selected:on}} onPress={()=>onPick(s)} style={{minHeight:48,justifyContent:'center',paddingHorizontal:16,borderRadius:14,borderWidth:1,borderColor:on?colors.accent:colors.borderSubtle,backgroundColor:on?colors.accent:'transparent'}}><T role="bodyStrong" style={on?{color:name==='light'?'#16181C':'#231E18',fontWeight:'700'}:null}>{s.startTime}</T></Pressable>})}</View></View>:null})}</View>
}
