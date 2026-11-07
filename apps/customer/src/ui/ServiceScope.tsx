import {Linking,View} from 'react-native';
import type {Service} from '@autodeck/core';
import {space} from '@autodeck/ui/theme';
import {Icon,useExperienceTheme} from '@autodeck/ui/native';
import {Button,Kicker,Notice,Pane,Row,T} from './kit';
import {showcaseFor} from '../lib/showcase';
import {manufacturerInfo} from '../lib/manufacturer-info';
/** Only catalogue-authored scope; confirmation questions never become promises. One visual scope list - booking questions live in the single Questions block on the same page, so there is no separate Before-you-book list. */
export function ServiceScope({service,onAsk}:{service:Pick<Service,'name'|'description'|'category'> & Partial<Pick<Service,'brand'>>;onAsk:()=>void}) {
 const {colors}=useExperienceTheme();
 const maker=manufacturerInfo({...service,brand:service.brand??null});
 const scope=showcaseFor(service).included;
 return <>
  {scope.length ? <View style={{gap:space.breath}}><Kicker>What's included</Kicker><Pane pad="gap">{scope.map((text,i)=>{
   // Only a "Where used:" line renders as chips, and each chip is a complete
   // surface name. Every other line is a full row so copy never fragments.
   const m=/^Where used:\s*(.+)$/i.exec(text);
   const areas=m?m[1].split(/,\s*/).map(x=>x.trim()).filter(Boolean):null;
   return areas&&areas.length?(
    <View key={text} style={{gap:8,paddingVertical:i?10:0,borderTopWidth:i?1:0,borderTopColor:'rgba(128,128,128,0.14)'}}>
     <T role="caption" tone="secondary">Where used</T>
     <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
      {areas.map((area)=>(<View key={area} style={{flexDirection:'row',alignItems:'center',gap:6,borderRadius:9999,paddingHorizontal:11,paddingVertical:7,backgroundColor:'rgba(236,134,56,0.12)',borderWidth:1,borderColor:'rgba(236,134,56,0.35)'}}><Icon name="check" color={colors.accent} size={13}/><T role="caption" tone="primary">{area}</T></View>))}
     </View>
    </View>
   ):(
    <Row key={text} title={<View style={{flexDirection:'row',gap:space.line}}><Icon name="check" color={colors.accent} size={18}/><View style={{flex:1}}><T>{text}</T></View></View>} last={i===scope.length-1}/>
   );
  })}</Pane></View> : <Notice title="Confirm the service scope" body="Ask the studio what is included for your car." action={<Button kind="quiet" label="Help & contact" onPress={onAsk}/>}/>}
  <T role="caption" tone="secondary">Need extra work? Ask the studio before booking.</T>
  <Row title="Ask about this service" detail="Contact the studio about inclusions, exclusions and care" onPress={onAsk} last/>
  {maker?<View style={{gap:space.breath}}><Kicker>Product and care</Kicker><Pane pad="gap"><T>{maker.summary}</T>{maker.notes.map(note=><T key={note} tone="secondary">{note}</T>)}{maker.sources.map(source=><Row key={source.url} title={source.label} detail="Manufacturer's website" onPress={()=>void Linking.openURL(source.url)} last/>)}</Pane><T role="caption" tone="tertiary">Ask for your product care guide and written warranty at handover.</T></View>:null}
 </>;
}
