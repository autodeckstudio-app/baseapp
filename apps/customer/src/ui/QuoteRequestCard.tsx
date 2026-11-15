import {View,Pressable} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import type {CustomerQuote} from '../lib/service-quote';
import {Button,Pane,T,rupees} from './kit';
const status:Record<string,string>={requested:'Awaiting quote',offered:'Quote ready',inspection_requested:'Review inspection',inspection_confirmed:'Inspection visit confirmed',inspection_arrived:'With the team',inspection_completed:'Preparing quote',accepted:'Quote accepted',declined:'Declined',visit_booked:'Service booked'};
/** Pending is a business state, not a loading skeleton or estimated price. */
export function QuoteRequestCard({quote,title,vehicleLabel,busy,onInspect,onDetails}:{quote:CustomerQuote;title:string;vehicleLabel?:string|undefined;busy:boolean;onInspect:()=>void;onDetails:()=>void}){
 const {colors}=useExperienceTheme();
 const waiting=['requested','inspection_requested','inspection_confirmed','inspection_arrived','inspection_completed'].includes(quote.phase);
 return <Pane pad="inset"><View style={{gap:18}}>
  <View style={{gap:8}}><T role="caption" tone="secondary">{status[quote.phase]??'Request'}</T><T role="heading">{title}</T>{vehicleLabel?<T role="caption" tone="secondary">{vehicleLabel}</T>:null}</View>
  <View style={{borderTopWidth:1,borderTopColor:colors.borderSubtle,paddingTop:14,gap:6}}>
   <T role="caption" tone="tertiary">{quote.offer?'QUOTED TOTAL':waiting?'PRICE':'STATUS'}</T>
   <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,minHeight:44}}>
    <View style={{flex:1,minWidth:0}}>{quote.offer?<T role="heading">{rupees(quote.offer.totalPaise)}</T>:<View style={{alignSelf:'flex-start',paddingHorizontal:12,paddingVertical:8,borderWidth:1,borderStyle:'dashed',borderColor:colors.borderSubtle,borderRadius:12}}><T role="caption" tone="secondary">{waiting?'Price pending':quote.phase==='declined'?'Request closed':'View booking'}</T></View>}</View>
    <Pressable accessibilityRole="button" accessibilityLabel={`View request details: ${title}`} onPress={onDetails} style={{minHeight:44,justifyContent:'center',paddingHorizontal:4}}><T role="caption">View details ›</T></Pressable>
   </View>
  </View>
  {quote.phase==='inspection_confirmed'?<T role="caption" tone="secondary">Studio is expecting your car. No service booking yet.</T>:null}
  {quote.phase==='requested'?<Button kind="quiet" label="Inspect my car first" disabled={busy} onPress={onInspect}/>:null}
 </View></Pane>;
}
