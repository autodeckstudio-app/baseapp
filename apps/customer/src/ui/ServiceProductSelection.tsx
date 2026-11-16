import {useEffect,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {useExperienceTheme,Icon} from '@autodeck/ui/native';
import type {Service} from '@autodeck/core';
import {spotlightProductPhoto as photo} from '../lib/catalogue-assets';
import {useScreenScrollToTop} from './kit';
/** Full statements remain readable; explicit quantities remain available for detail rendering. */
export function productHighlight(raw:string){
 const clean=raw.replace(/^Maker claim:\s*/i,'').replace(/heat-activated repair of minor scratches at about 100°C/i,'Heat-activated minor-scratch repair · ~100°C');
 const text=clean.charAt(0).toUpperCase()+clean.slice(1);
 const quantity=text.match(/\d+nm\s*\+\s*\d+nm/i)?.[0]??text.match(/pH\s*\d+(?:[–-]\d+)?/i)?.[0]??text.match(/(?:[~><≥≤]\s*)?\d+(?:\.\d+)?(?:[-–]\d+(?:\.\d+)?)?\s*(?:°C|%|H\+?|µm|microns?|mil\b|nm\b|km\/h|pH\b)/i)?.[0];
 const icon:Parameters<typeof Icon>[0]['name']=/UV|sun/i.test(text)?'sun':/water|hydrophob|rain/i.test(text)?'wash':/gloss|colour|shine/i.test(text)?'star':/scratch|heal|repair/i.test(text)?'wrench':/film|layer|TPU|coat/i.test(text)?'ppf-film':'shield';
 return {text,quantity,icon};
}


/** One product spotlight and a flat priced range. Previewing never books or opens details. */
export function ServiceProductSelection({title,description,services,priceLabel,onOpen}:{title:string;description?:string|undefined;services:Service[];priceLabel:(service:Service)=>string|null|undefined;onOpen:(service:Service)=>void}){
 const {name}=useExperienceTheme();const night=name==='night';const scrollToTop=useScreenScrollToTop();
 const ink=night?'#f4f3f6':'#191b20',muted=night?'#a3a3ae':'#737681',rule=night?'#33343c':'#e7e7eb',accent=night?'#c7b4f1':'#70609e',chosen=night?'#282236':'#f1eef9';
 const font={fontFamily:'Inter, system-ui, sans-serif',color:ink};
 const [selectedId,setSelectedId]=useState<string|null>(services[0]?.id??null);const identity=services.map(s=>s.id).join('|');
 useEffect(()=>setSelectedId(services[0]?.id??null),[title,identity]);
 const s=services.find(item=>item.id===selectedId)??services[0];
 const short=(item:Service)=>item.brand==='Standard'?'Standard':item.name.replace(new RegExp(`^${item.brand??''}\\s+`,'i'),'');
 if(!s)return <Text style={[font,{padding:18,fontSize:13,lineHeight:20}]}>Bring your car to the studio for inspection.</Text>;
 const lines=(s.description??'').split('\n').filter(Boolean),conditions=lines.slice(1).filter(x=>/^(?:Not|Only for|Requires|Do not)\b/i.test(x)),highlights=lines.slice(1).filter(x=>!conditions.includes(x));
 const featured=highlights.length>2&&/Garware Titanium/.test(s.name)?highlights.filter(x=>/Top-tier Garware/.test(x)):highlights.slice(0,2);
 const warranty=s.warrantyLabel?.match(/(?:\d+ years?|lifetime)/i)?.[0];
 const warrantyConditions=s.warrantyLabel?.replace(/^Brand\s+/i,'').replace(warranty??'','').replace(/^(?:limited\s+)?(?:e-)?warranty\s*:?\s*/i,'').replace(/^[\s·:]+/,'').trim();
 const price=(item:Service)=>item.priceOnRequest?'Studio inspection':priceLabel(item)??'Studio inspection';const image=photo(s);
 return <View style={{padding:0,gap:0,minWidth:0}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:16,minHeight:image?180:110}}>
   <View style={{flex:1,minWidth:0,gap:9}}><Text accessibilityRole="header" style={[font,{fontSize:28,lineHeight:31,letterSpacing:-1,fontWeight:'600'}]}>{short(s)}</Text><Text style={[font,{fontSize:21,lineHeight:27,fontWeight:'600',letterSpacing:-.5}]}>{price(s)}</Text>{lines[0]?<Text style={[font,{fontSize:12,lineHeight:19,color:muted}]}>{lines[0]}</Text>:null}</View>
   {image?<Image accessibilityLabel={`${s.name} product`} source={image} resizeMode="contain" style={{width:76,height:176}}/>:null}
  </View>
  <View style={{borderTopWidth:1,borderBottomWidth:1,borderColor:rule,flexDirection:'row',flexWrap:'wrap',paddingVertical:12,rowGap:12}}>
   <View accessibilityLabel={s.priceOnRequest?'Studio inspection':`${s.estimatedDurationMinutes/60}h working time`} style={{flexDirection:'row',gap:6,alignItems:'baseline',paddingRight:14}}><Text style={[font,{fontSize:21,lineHeight:25,fontWeight:'600'}]}>{s.priceOnRequest?'Visit':`${s.estimatedDurationMinutes/60}h`}</Text><Text style={[font,{fontSize:10,color:muted}]}>{s.priceOnRequest?'studio first':'working time'}</Text></View>
   {warranty?<View accessibilityLabel={`${warranty} ${/limited/i.test(s.warrantyLabel??'')?'limited warranty':/e-warranty/i.test(s.warrantyLabel??'')?'E-warranty':'Warranty'}`} style={{flexDirection:'row',gap:6,alignItems:'baseline',borderLeftWidth:1,borderLeftColor:rule,paddingLeft:14}}><Text style={[font,{fontSize:/lifetime/i.test(warranty)?16:21,lineHeight:25,fontWeight:'600'}]}>{warranty.replace(/ years?/i,'y').replace(/^lifetime/i,'Lifetime')}</Text><Text style={[font,{fontSize:10,color:muted}]}>{/limited/i.test(s.warrantyLabel??'')?'limited warranty':/e-warranty/i.test(s.warrantyLabel??'')?'E-warranty':'brand warranty'}</Text></View>:null}
  </View>
  <View style={{gap:11,paddingVertical:14}}>{featured.map((raw,i)=>{const f=productHighlight(raw);return <View key={i} style={{flexDirection:'row',alignItems:'center',gap:9}}><Icon mono name="check" size={15} color={accent}/><Text style={[font,{flex:1,fontSize:11,lineHeight:17}]}>{f.text}</Text></View>})}</View>
  {conditions.map((text,i)=><Text key={i} style={[font,{fontSize:10,lineHeight:16,color:muted,marginBottom:7}]}>{text}</Text>)}
  {s.priceOnRequest?<Text style={[font,{fontSize:10,lineHeight:16,color:muted,marginBottom:7}]}>Confirm work &amp; price first</Text>:null}
  {warranty?<Text style={[font,{fontSize:10,lineHeight:16,color:muted,marginBottom:10}]}>{warrantyConditions?`${warrantyConditions.charAt(0).toUpperCase()+warrantyConditions.slice(1)}. `:''}Confirm studio eligibility.</Text>:null}
  <Pressable accessibilityRole="button" accessibilityLabel={`View ${s.name}`} onPress={()=>onOpen(s)} style={{minHeight:44,paddingHorizontal:14,borderRadius:8,backgroundColor:night?'#e8e2f7':'#202126',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={[font,{fontSize:12,fontWeight:'600',color:night?'#201a2c':'#fff'}]}>{s.priceOnRequest?'Inspection details':'Explore service'}</Text><Text aria-hidden style={{fontSize:19,color:night?'#201a2c':'#fff'}}>↗</Text></Pressable>
  <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:25,marginBottom:9}}><Text style={[font,{fontSize:11,fontWeight:'600'}]}>Compare the range</Text><Text style={[font,{fontSize:10,color:muted}]}>{services.length} products</Text></View>
  <View accessibilityRole="radiogroup" accessibilityLabel={`${title} products`}>{services.map(row=>{const active=row.id===s.id,im=photo(row);return <Pressable key={row.id} accessibilityRole="radio" accessibilityLabel={`Select ${row.name}`} accessibilityState={{checked:active}} onPress={()=>{setSelectedId(row.id);scrollToTop()}} style={{minHeight:58,borderBottomWidth:active?0:1,borderBottomColor:rule,borderRadius:active?8:0,paddingHorizontal:10,paddingVertical:10,backgroundColor:active?chosen:'transparent',flexDirection:'row',alignItems:'center',gap:10}}>{im?<Image source={im} resizeMode="contain" style={{width:20,height:34}}/>:null}<Text style={[font,{flex:1,minWidth:0,fontSize:12,lineHeight:18,fontWeight:'500'}]}>{short(row)}</Text><Text style={[font,{fontSize:12,lineHeight:18,fontWeight:'600',maxWidth:'43%',textAlign:'right'}]}>{price(row)}</Text><View style={{width:13}}>{active?<Icon mono name="check" size={13} color={accent}/>:null}</View></Pressable>})}</View>
  <Text style={[font,{fontSize:10,lineHeight:16,color:muted,marginTop:12}]}>Tap a product to compare. Selection does not book.</Text>
 </View>;
}
