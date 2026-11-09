import{useEffect,useState}from'react';
import {Linking,View} from 'react-native';
import type {Service} from '@autodeck/core';
import {space} from '@autodeck/ui/theme';
import {Icon,useExperienceTheme} from '@autodeck/ui/native';
import {Button,Kicker,Notice,Pane,Row,T} from './kit';
import {showcaseFor} from '../lib/showcase';
import {manufacturerInfo} from '../lib/manufacturer-info';
/** Only catalogue-authored scope; confirmation questions never become promises. One visual scope section on the service page: Includes, one care tip and a single Ask-the-studio row - booking FAQ questions are no longer listed on the page. */
export function ServiceScope({service,onAsk,careTip,placement="combined"}:{placement?:"combined"|"description"|"details";service:Pick<Service,'name'|'description'|'category'> & Partial<Pick<Service,'brand'>>;onAsk:()=>void;careTip?:string|null}) {
 const {colors}=useExperienceTheme();const[productOpen,setProductOpen]=useState(false);
 useEffect(()=>setProductOpen(false),[service.name,service.brand,service.description]);
 const maker=manufacturerInfo({...service,brand:service.brand??null});
 const scope=showcaseFor(service).included;
 return <>
  {placement!=="details"&&scope.length ? <View style={{gap:space.breath}}>{placement==="combined"?<Kicker>What's included</Kicker>:null}<Pane pad="gap">{scope.map((text,i)=>{
   // Only a "Where used:" line renders as chips, and each chip is a complete
   // surface name. Every other line is a full row so copy never fragments.
   const captured=/^Where used:\s*(.+)$/i.exec(text)?.[1];
   const areas=captured?captured.split(/,\s*/).map(x=>x.trim()).filter(Boolean):null;
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
  })}{placement==="description"?null:<>{careTip?<><View style={{height:1,backgroundColor:'rgba(128,128,128,0.14)'}}/><View style={{gap:space.breath}}><Kicker>Care tip</Kicker><T>{careTip}</T></View></>:null}<View style={{height:1,backgroundColor:'rgba(128,128,128,0.14)'}}/><Row title="Ask the studio" detail="Questions about this service" onPress={onAsk} last/></>}</Pane></View> : placement==="details"?null:<Notice title="Confirm the service scope" body="Ask the studio what is included for your car." action={<Button kind="quiet" label="Ask the studio" onPress={onAsk}/>}/>}
  {placement==="details"?<Pane pad="gap">{careTip?<View style={{gap:space.breath}}><Kicker>Care tip</Kicker><T>{careTip}</T></View>:null}<Row title="Ask the studio" detail="Questions about this service" onPress={onAsk} last/></Pane>:null}
  {placement!=="description"&&maker?<View style={{gap:space.breath}}><Pane pad="gap"><Row title="Product and care" detail={productOpen?"Hide manufacturer details":"Manufacturer details and care guide"} onPress={()=>setProductOpen(!productOpen)} last={!productOpen}/>{productOpen?<View style={{gap:12}}><T>{maker.summary}</T>{maker.notes.map(note=><T key={note} tone="secondary">{note}</T>)}{maker.sources.map(source=><Row key={source.url} title={source.label} detail="Manufacturer's website" onPress={()=>void Linking.openURL(source.url)} last/>)}</View>:null}</Pane><T role="caption" tone="tertiary">Ask for your product care guide and written warranty at handover.</T></View>:null}
 </>;
}
