import{raised}from'../lib/raised';
import{serviceActionSurface}from'../lib/service-action-surface';
import {ProtectionFamilyIntro,type ProtectionFamily} from './ProtectionFamilyIntro';
import {ServiceIdentityMedia} from './ServiceIdentityMedia';
import {serviceExplanation} from '../lib/service-explanations';
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


function BrandMark({service,small=false}:{service:Service;small?:boolean}){const {colors}=useExperienceTheme();const brand=service.brand??'',logo=BRAND_LOGOS[brand];if(brand==='Standard')return <Icon mono name="shield" size={small?20:32} color={colors.textSecondary}/>;return logo?<View style={{width:small?44:86,height:small?28:58,borderRadius:6,padding:small?3:7,backgroundColor:['Fireball','LLumar','Keramic','Keramik','Cosmo'].includes(brand)?colors.surfaceElevated:'transparent',alignItems:'center',justifyContent:'center'}}><Image accessibilityLabel={`${brand==='Keramic'?'Keramik':brand} brand logo`} source={logo.src} resizeMode="contain" style={{width:'100%',height:'100%'}}/></View>:<Text style={{fontSize:small?8:12,color:colors.textSecondary}}>{brand}</Text>;}

/** One product spotlight and a flat priced range. Previewing never books or opens details. */
export function ServiceProductSelection({title,description,services,priceLabel,onOpen,onBook,onInspect,careAction,onSelectForVisit,selectedForVisit}:{title:string;description?:string|undefined;onSelectForVisit?:((s:Service)=>void)|undefined;selectedForVisit?:readonly string[];careAction?:{label:string;onPress:()=>void}|undefined;services:Service[];priceLabel:(service:Service)=>string|null|undefined;onOpen:(service:Service)=>void;onBook?:((service:Service)=>void)|undefined;onInspect?:((service:Service)=>void)|undefined}){
 const {name,colors}=useExperienceTheme();const night=name==='night';const scrollToTop=useScreenScrollToTop();
 const ink=colors.textPrimary,muted=colors.textSecondary,rule=colors.borderSubtle,accent=colors.accentStrong,chosen=colors.accentHaze;
 const font={fontFamily:'Inter, system-ui, sans-serif',color:ink};
 const [showWarranty,setShowWarranty]=useState(false),[showFamilyGuide,setShowFamilyGuide]=useState(false);
 const [selectedId,setSelectedId]=useState<string|null>(services[0]?.id??null);const identity=services.map(s=>s.id).join('|');
 useEffect(()=>{setSelectedId(services[0]?.id??null);setShowWarranty(false);setShowFamilyGuide(false)},[title,identity]);
 const s=services.find(item=>item.id===selectedId)??services[0];
 const short=productDisplayName;
 if(!s)return <Text style={[font,{padding:18,fontSize:13,lineHeight:20}]}>Tell us what you have in mind and discuss the options.</Text>;
 const turnaround=customerTurnaround(s);const duration=s.estimatedDurationMinutes;const workingTime=!Number.isFinite(duration)||duration<=0?'Confirm timing':duration<60?`${duration} min`:duration%60===0?`${duration/60} ${duration===60?'hour':'hours'}`:`${Math.floor(duration/60)}h ${duration%60}min`;const warranty=s.customerMenu?null:manufacturerWarranty(s.name);const application=manufacturerApplicationTerms(s.name);
 const explanation=serviceExplanation(s);const servicePage=true;const productPage=s.customerMenu?.home==='paint';
 const lines=(explanation.length?explanation.join('\n'):productSelectionDescription(s)).split('\n').filter(Boolean),conditions=lines.slice(1).filter(x=>/^(?:Not|Only for|Requires|Do not)\b/i.test(x)&&x!=='Not an automotive warranty'),highlights=lines.slice(1).filter(x=>!conditions.includes(x)&&x!=='Not an automotive warranty');
 const featured=highlights;
 const price=(item:Service)=>item.priceOnRequest?'Quote on request':priceLabel(item)??'Quote on request';
 return <View style={{padding:0,gap:0,minWidth:0}}>
  <View testID="service-summary-card" style={{...raised(name).card,padding:12,gap:0}}>
  <ServiceIdentityMedia service={s} compact/>
  <View style={{paddingVertical:12,gap:7}}>
   <View testID="service-title-price" style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10}}><Text accessibilityRole="header" style={[font,{flex:1,minWidth:0,fontSize:24,lineHeight:30,letterSpacing:-.7,fontWeight:'600'}]}>{productPage&&s.brand!=='Standard'?short(s):s.name}</Text><Text style={[font,{maxWidth:'43%',flexShrink:0,textAlign:'right',fontSize:s.priceOnRequest?13:20,lineHeight:28,fontWeight:'600',letterSpacing:-.4}]}>{price(s)}</Text></View>
   {lines[0]?<Text style={[font,{fontSize:13,lineHeight:20,color:muted}]}>{lines[0]}</Text>:null}
  </View>
  {warranty||application?<View style={{borderTopWidth:1,borderBottomWidth:1,borderColor:rule,flexDirection:'row',alignItems:'flex-start',paddingVertical:12,gap:12}}>
   {warranty?<Pressable accessibilityRole="button" accessibilityLabel={`Manufacturer warranty ${warranty.duration}, conditional. View terms`} accessibilityState={{expanded:showWarranty}} onPress={()=>setShowWarranty(!showWarranty)} style={{flex:1,minHeight:44,justifyContent:'center',borderLeftWidth:1,borderLeftColor:rule,paddingLeft:12,gap:2}}><Text style={[font,{fontSize:12,lineHeight:17,color:muted}]}>{warranty.duration.replace(/ years?/,'y')} manufacturer warranty</Text><Text style={[font,{fontSize:10,lineHeight:15,color:muted,textDecorationLine:'underline'}]}>Conditional · view terms</Text></Pressable>:application?<Pressable accessibilityRole="button" accessibilityLabel="Manufacturer application terms. View terms" accessibilityState={{expanded:showWarranty}} onPress={()=>setShowWarranty(!showWarranty)} style={{flex:1,minHeight:44,justifyContent:'center',borderLeftWidth:1,borderLeftColor:rule,paddingLeft:12,gap:2}}><Text style={[font,{fontSize:12,lineHeight:17,color:muted}]}>Application terms</Text><Text style={[font,{fontSize:10,lineHeight:15,color:muted,textDecorationLine:'underline'}]}>View terms</Text></Pressable>:null}
  </View>:null}
  {s.customerMenu&&s.warrantyLabel?<View style={{paddingVertical:12,gap:5}}><Text style={[font,{fontSize:12,color:muted}]}>{s.warrantyLabel}</Text><Text style={[font,{fontSize:10,lineHeight:16,color:muted}]}>Manufacturer terms apply. Confirm eligibility and registration with the studio.</Text></View>:null}
  {application&&showWarranty?<View style={{paddingVertical:10}}><Text style={[font,{fontSize:11,lineHeight:17,color:muted}]}>{application.terms}</Text></View>:null}
  {warranty&&showWarranty?<View style={{gap:5,paddingVertical:10}}><Text style={[font,{fontSize:11,lineHeight:17,color:muted}]}>{warranty.terms}</Text><Text style={[font,{fontSize:11,lineHeight:17,color:muted}]}>Applies only to eligible installations under the manufacturer's terms.</Text></View>:null}

  <View style={{gap:9,paddingVertical:featured.length?12:6}}>{featured.map((raw,i)=>{const f=productHighlight(raw);return <View key={i} style={{flexDirection:'row',alignItems:'center',gap:9}}><Icon mono name="check" size={15} color={accent}/><Text style={[font,{flex:1,fontSize:12,lineHeight:18}]}>{f.text}</Text></View>})}</View>
  {conditions.filter(text=>!(application&&text==='Requires a brand-selected installer')).map((text,i)=><Text key={i} style={[font,{fontSize:10,lineHeight:16,color:muted,marginBottom:7}]}>Compatibility: {text}</Text>)}


  <Pressable accessibilityRole="button" accessibilityLabel={onSelectForVisit?(selectedForVisit?.includes(s.id)?'Remove ':'Add ')+s.name:`${s.priceOnRequest?'Discuss requirements for':'Review booking for'} ${s.name}`} onPress={()=>onSelectForVisit?onSelectForVisit(s):s.priceOnRequest&&onInspect?onInspect(s):onOpen(s)} style={({pressed})=>({...serviceActionSurface(name,!!selectedForVisit?.includes(s.id),pressed),minHeight:46,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'center'})}><Text style={[font,{fontSize:12,fontWeight:'600',color:ink}]}>{onSelectForVisit?(selectedForVisit?.includes(s.id)?'Added':'Add to cart'):s.priceOnRequest?'Discuss your requirements':'Review & book'}</Text></Pressable>
  {s.priceOnRequest?<Pressable accessibilityRole="button" accessibilityLabel={`Full details for ${s.name}`} onPress={()=>onOpen(s)} style={{minHeight:44,justifyContent:'center',alignItems:'center',marginTop:4}}><Text style={[font,{fontSize:11,color:muted,textDecorationLine:'underline'}]}>Full service details</Text></Pressable>:null}
  </View>
  {services.length>1?<View>
  <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:18,marginBottom:7}}><Text style={[font,{fontSize:11,fontWeight:'600'}]}>Choose an option</Text><Text style={[font,{fontSize:10,color:muted}]}>{services.length} {services.length===1?'option':'options'}</Text></View>
  <View accessibilityRole="radiogroup" accessibilityLabel={`${title} ${servicePage?'services':'products'}`}>{services.map(row=>{const active=row.id===s.id,im=photo(row);return <Pressable key={row.id} accessibilityRole="radio" accessibilityLabel={`Select ${row.name}`} accessibilityState={{checked:active}} onPress={()=>{setSelectedId(row.id);setShowWarranty(false);setShowFamilyGuide(false);scrollToTop()}} style={{minHeight:64,borderBottomWidth:1,borderBottomColor:active?'transparent':rule,borderRadius:active?8:0,paddingHorizontal:8,paddingVertical:10,backgroundColor:active?chosen:'transparent',flexDirection:'row',alignItems:'center',gap:8}}><View testID="product-comparison-thumbnail" style={{width:48,height:40,flexShrink:0,alignItems:'center',justifyContent:'center'}}>{im?<Image accessibilityLabel={`${row.name} thumbnail`} source={im} resizeMode="contain" style={{width:48,height:38}}/>:<BrandMark service={row} small/>}</View><Text style={[font,{flex:1,minWidth:0,fontSize:12,lineHeight:18,fontWeight:'500'}]}>{productPage&&row.brand!=='Standard'?short(row):row.name}</Text><Text style={[font,{fontSize:12,lineHeight:18,fontWeight:'600',width:78,flexShrink:0,textAlign:'right'}]}>{price(row)}</Text><View style={{width:13,flexShrink:0}}>{active?<Icon mono name="check" size={13} color={accent}/>:null}</View></Pressable>})}</View>
  <Text style={[font,{fontSize:10,lineHeight:16,color:muted,marginTop:12}]}>{servicePage?'Select a service to read about it. Selection does not book.':'Tap a product to compare. Selection does not book.'}</Text>

  </View>:null}
 {productPage&&['Ceramic','PPF','PPS'].includes(s.customerMenu?.family??'')?<View style={{marginTop:24,gap:14}}>{s.customerMenu?.family==='PPS'?<ProtectionFamilyIntro showMedia={false} family="PPS" careAction={careAction}/>:<><Text style={[font,{fontSize:16,lineHeight:23,fontWeight:'600'}]}>Aftercare</Text><ProtectionFamilyIntro showMedia={false} mode="care" family={s.customerMenu!.family as ProtectionFamily} careAction={careAction}/><Pressable accessibilityRole="button" accessibilityLabel={`${s.customerMenu!.family} protection guide`} accessibilityState={{expanded:showFamilyGuide}} onPress={()=>setShowFamilyGuide(v=>!v)} style={{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:rule}}><Text style={[font,{fontSize:13,lineHeight:20}]}>Protection guide</Text><Text style={[font,{fontSize:18,color:muted}]}>{showFamilyGuide?'−':'+'}</Text></Pressable>{showFamilyGuide?<ProtectionFamilyIntro showMedia={false} mode="overview" family={s.customerMenu!.family as ProtectionFamily}/>:null}</>}</View>:null}
 </View>;
}
