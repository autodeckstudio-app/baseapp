import {productSelectionDescription} from '../lib/product-selection-copy';
import {customerTurnaround} from '../lib/customer-turnaround';
import{productDisplayName}from'../lib/product-display-name';
import {useEffect,useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {useExperienceTheme,Icon} from '@autodeck/ui/native';
import type {Service} from '@autodeck/core';
import {manufacturerApplicationTerms,manufacturerWarranty} from '../lib/product-manufacturer-warranty';
import {BRAND_LOGOS} from '../lib/brand-logos';
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


function BrandMark({service,small=false}:{service:Service;small?:boolean}){const brand=service.brand??'',logo=BRAND_LOGOS[brand];return logo?<View style={{width:small?44:86,height:small?28:58,borderRadius:6,padding:small?3:7,backgroundColor:['Fireball','LLumar','Keramic','Keramik','Cosmo'].includes(brand)?'#edeaf3':'transparent',alignItems:'center',justifyContent:'center'}}><Image accessibilityLabel={`${brand==='Keramic'?'Keramik':brand} brand logo`} source={logo.src} resizeMode="contain" style={{width:'100%',height:'100%'}}/></View>:<Text style={{fontSize:small?8:12}}>{brand}</Text>;}

/** One product spotlight and a flat priced range. Previewing never books or opens details. */
export function ServiceProductSelection({title,description,services,priceLabel,onOpen}:{title:string;description?:string|undefined;services:Service[];priceLabel:(service:Service)=>string|null|undefined;onOpen:(service:Service)=>void}){
 const {name}=useExperienceTheme();const night=name==='night';const scrollToTop=useScreenScrollToTop();
 const ink=night?'#f4f3f6':'#191b20',muted=night?'#a3a3ae':'#737681',rule=night?'#33343c':'#e7e7eb',accent=night?'#c7b4f1':'#70609e',chosen=night?'#282236':'#f1eef9';
 const font={fontFamily:'Inter, system-ui, sans-serif',color:ink};
 const [showWarranty,setShowWarranty]=useState(false);
 const [selectedId,setSelectedId]=useState<string|null>(services[0]?.id??null);const identity=services.map(s=>s.id).join('|');
 useEffect(()=>{setSelectedId(services[0]?.id??null);setShowWarranty(false)},[title,identity]);
 const s=services.find(item=>item.id===selectedId)??services[0];
 const short=productDisplayName;
 if(!s)return <Text style={[font,{padding:18,fontSize:13,lineHeight:20}]}>Bring your car to the studio for inspection.</Text>;
 const turnaround=customerTurnaround(s);const warranty=manufacturerWarranty(s.name);const application=manufacturerApplicationTerms(s.name);
 const lines=productSelectionDescription(s).split('\n').filter(Boolean),conditions=lines.slice(1).filter(x=>/^(?:Not|Only for|Requires|Do not)\b/i.test(x)&&x!=='Not an automotive warranty'),highlights=lines.slice(1).filter(x=>!conditions.includes(x)&&x!=='Not an automotive warranty');
 const featured=highlights.length>2&&/Garware Titanium/.test(s.name)?highlights.filter(x=>/Top-tier Garware/.test(x)):highlights.slice(0,2);
 const price=(item:Service)=>item.priceOnRequest?'Studio inspection':priceLabel(item)??'Studio inspection';const image=photo(s);
 return <View style={{padding:0,gap:0,minWidth:0}}>
  <View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:12,minHeight:132}}>
   <View style={{flex:1,minWidth:0,gap:9}}><Text accessibilityRole="header" style={[font,{fontSize:28,lineHeight:31,letterSpacing:-1,fontWeight:'600'}]}>{short(s)}</Text><Text style={[font,{fontSize:21,lineHeight:27,fontWeight:'600',letterSpacing:-.5}]}>{price(s)}</Text>{lines[0]?<Text style={[font,{fontSize:12,lineHeight:19,color:muted}]}>{lines[0]}</Text>:null}</View>
   <View style={{width:86,height:110,alignItems:'center',justifyContent:'center'}}>{image?<Image accessibilityLabel={`${s.name} product`} source={image} resizeMode="contain" style={{width:86,height:110}}/>:<BrandMark service={s}/>}</View>
  </View>
  <View style={{borderTopWidth:1,borderBottomWidth:1,borderColor:rule,flexDirection:'row',alignItems:'center',paddingVertical:11,gap:12}}>
   <Text accessibilityLabel={turnaround.accessible} style={[font,{fontSize:13,lineHeight:18,fontWeight:'500'}]}>{turnaround.value}</Text>
   {warranty?<Pressable accessibilityRole="button" accessibilityLabel={`Manufacturer warranty ${warranty.duration}, conditional. View terms`} accessibilityState={{expanded:showWarranty}} onPress={()=>setShowWarranty(!showWarranty)} style={{flex:1,minHeight:44,justifyContent:'center',borderLeftWidth:1,borderLeftColor:rule,paddingLeft:12,gap:2}}><Text style={[font,{fontSize:12,lineHeight:17,color:muted}]}>{warranty.duration.replace(/ years?/,'y')} manufacturer warranty</Text><Text style={[font,{fontSize:10,lineHeight:15,color:muted,textDecorationLine:'underline'}]}>Conditional · view terms</Text></Pressable>:application?<Pressable accessibilityRole="button" accessibilityLabel="Manufacturer application terms. View terms" accessibilityState={{expanded:showWarranty}} onPress={()=>setShowWarranty(!showWarranty)} style={{flex:1,minHeight:44,justifyContent:'center',borderLeftWidth:1,borderLeftColor:rule,paddingLeft:12,gap:2}}><Text style={[font,{fontSize:12,lineHeight:17,color:muted}]}>Application terms</Text><Text style={[font,{fontSize:10,lineHeight:15,color:muted,textDecorationLine:'underline'}]}>View terms</Text></Pressable>:null}
  </View>
  {application&&showWarranty?<View style={{paddingVertical:10}}><Text style={[font,{fontSize:11,lineHeight:17,color:muted}]}>{application.terms}</Text></View>:null}
  {warranty&&showWarranty?<View style={{gap:5,paddingVertical:10}}><Text style={[font,{fontSize:11,lineHeight:17,color:muted}]}>{warranty.terms}</Text><Text style={[font,{fontSize:11,lineHeight:17,color:muted}]}>Applies only to eligible installations under the manufacturer's terms.</Text></View>:null}

  <View style={{gap:11,paddingVertical:14}}>{featured.map((raw,i)=>{const f=productHighlight(raw);return <View key={i} style={{flexDirection:'row',alignItems:'center',gap:9}}><Icon mono name="check" size={15} color={accent}/><Text style={[font,{flex:1,fontSize:11,lineHeight:17}]}>{f.text}</Text></View>})}</View>
  {conditions.filter(text=>!(application&&text==='Requires a brand-selected installer')).map((text,i)=><Text key={i} style={[font,{fontSize:10,lineHeight:16,color:muted,marginBottom:7}]}>Compatibility: {text}</Text>)}


  <Pressable accessibilityRole="button" accessibilityLabel={`View ${s.name}`} onPress={()=>onOpen(s)} style={{minHeight:44,paddingHorizontal:14,borderRadius:8,backgroundColor:night?'#e8e2f7':'#202126',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Text style={[font,{fontSize:12,fontWeight:'600',color:night?'#201a2c':'#fff'}]}>{s.priceOnRequest?'Inspection details':'Explore service'}</Text></Pressable>
  <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:25,marginBottom:9}}><Text style={[font,{fontSize:11,fontWeight:'600'}]}>Compare the range</Text><Text style={[font,{fontSize:10,color:muted}]}>{services.length} products</Text></View>
  <View accessibilityRole="radiogroup" accessibilityLabel={`${title} products`}>{services.map(row=>{const active=row.id===s.id,im=photo(row);return <Pressable key={row.id} accessibilityRole="radio" accessibilityLabel={`Select ${row.name}`} accessibilityState={{checked:active}} onPress={()=>{setSelectedId(row.id);setShowWarranty(false);scrollToTop()}} style={{minHeight:64,borderBottomWidth:1,borderBottomColor:active?'transparent':rule,borderRadius:active?8:0,paddingHorizontal:8,paddingVertical:10,backgroundColor:active?chosen:'transparent',flexDirection:'row',alignItems:'center',gap:8}}><View testID="product-comparison-thumbnail" style={{width:48,height:40,flexShrink:0,alignItems:'center',justifyContent:'center'}}>{im?<Image accessibilityLabel={`${row.name} thumbnail`} source={im} resizeMode="contain" style={{width:48,height:38}}/>:<BrandMark service={row} small/>}</View><Text style={[font,{flex:1,minWidth:0,fontSize:12,lineHeight:18,fontWeight:'500'}]}>{short(row)}</Text><Text style={[font,{fontSize:12,lineHeight:18,fontWeight:'600',width:78,flexShrink:0,textAlign:'right'}]}>{price(row)}</Text><View style={{width:13,flexShrink:0}}>{active?<Icon mono name="check" size={13} color={accent}/>:null}</View></Pressable>})}</View>
  <Text style={[font,{fontSize:10,lineHeight:16,color:muted,marginTop:12}]}>Tap a product to compare. Selection does not book.</Text>
 </View>;
}
