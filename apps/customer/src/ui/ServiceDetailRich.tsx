import{raised}from'../lib/raised';
import{serviceActionSurface}from'../lib/service-action-surface';
import{ServiceIdentityMedia}from'./ServiceIdentityMedia';
import{serviceExplanation}from'../lib/service-explanations';
import{productSelectionDescription}from'../lib/product-selection-copy';
import{productDisplayName}from'../lib/product-display-name';
import{productHighlight}from'./ServiceProductSelection';
import{useEffect,useState}from'react';
import{Image,Pressable,Text,View}from'react-native';
import{Icon,useExperienceTheme}from'@autodeck/ui/native';
import type{Service}from'@autodeck/core';
import{BRAND_LOGOS}from'../lib/brand-logos';
import{spotlightProductPhoto as photo}from'../lib/catalogue-assets';
import{useScreenScrollToTop}from'./kit';

/** One non-paint service, same detailed language as the protection pages: hero,
 *  writing, iconified points, care and a quiet action. Copy stays canonical —
 *  every shown line comes from the catalogue record or reviewed product copy;
 *  no invented prices, timing, warranty or benefits. Selecting never books. */
export function ServiceDetailRich({service,siblings,priceLabel,eligible,added,onToggle,onOpen,onInspect,onSelect,serviceTitle,optionLabel}:{service:Service;siblings:Service[];serviceTitle?:string|undefined;optionLabel?:((service:Service)=>string)|undefined;priceLabel:(service:Service)=>string|null|undefined;eligible:boolean;added:boolean;onToggle?:((s:Service)=>void)|undefined;onOpen:(s:Service)=>void;onInspect:(s:Service)=>void;onSelect:(s:Service)=>void}){
 const{name,colors}=useExperienceTheme();const scrollToTop=useScreenScrollToTop();
 const ink=colors.textPrimary,muted=colors.textSecondary,rule=colors.borderSubtle,accent=colors.accentStrong,chosen=colors.accentHaze;
 const font={fontFamily:'Inter, system-ui, sans-serif',color:ink};
 const s=service;
 const explanation=serviceExplanation(s);
 const lines=(explanation.length?explanation.join('\n'):productSelectionDescription(s)).split('\n').filter(Boolean);
 const conditions=lines.slice(1).filter(x=>/^(?:Not|Only for|Requires|Do not)\b/i.test(x)&&x!=='Not an automotive warranty');
 const points=lines.slice(1).filter(x=>!conditions.includes(x)&&x!=='Not an automotive warranty');
 const care=(s.careTips??[]).filter(t=>t&&t.trim());
 const quote=s.priceOnRequest===true;
 const price=(item:Service)=>item.priceOnRequest?'Quote on request':priceLabel(item)??'Quote on request';
 const actionLabel=eligible?(added?'Added':'Add to cart'):quote?'Discuss your requirements':'Review & book';
 const actionPress=()=>{if(eligible&&onToggle)onToggle(s);else if(quote)onInspect(s);else onOpen(s)};
 return <View testID="service-detail-rich" style={{gap:16,minWidth:0}}>
  <ServiceIdentityMedia service={s} compact={!!serviceTitle}/>
  <View style={{gap:7}}>
   <View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10}}>
    <Text accessibilityRole="header" style={[font,{flex:1,minWidth:0,fontSize:22,lineHeight:28,letterSpacing:-.7,fontWeight:'600'}]}>{serviceTitle??(s.brand&&s.brand!=='Standard'&&s.brand!=='Add-ons'?productDisplayName(s):s.name)}</Text>
    <Text style={[font,{maxWidth:'43%',flexShrink:0,textAlign:'right',fontSize:quote?13:20,lineHeight:28,fontWeight:'600',letterSpacing:-.4}]}>{price(s)}</Text>
   </View>
   {serviceTitle?<Text style={[font,{fontSize:12,lineHeight:18,color:accent}]}>{optionLabel?.(s)??s.name}</Text>:null}
   {lines[0]?<Text style={[font,{fontSize:13,lineHeight:20,color:muted}]}>{lines[0]}</Text>:null}
  </View>
  {siblings.length>1?<View>
   <View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8,marginBottom:7}}><Text style={[font,{fontSize:11,fontWeight:'600'}]}>Choose an option</Text><Text style={[font,{fontSize:10,color:muted}]}>{siblings.length} options</Text></View>
   <View accessibilityRole="radiogroup" accessibilityLabel="Service options">{siblings.map(row=>{const active=row.id===s.id,im=photo(row),logo=row.brand?BRAND_LOGOS[row.brand]:undefined;return <Pressable key={row.id} accessibilityRole="radio" accessibilityLabel={`Select ${row.name}`} accessibilityState={{checked:active}} onPress={()=>{onSelect(row);scrollToTop()}} style={{minHeight:serviceTitle?48:64,borderBottomWidth:1,borderBottomColor:active?'transparent':rule,borderRadius:active?8:0,paddingHorizontal:8,paddingVertical:10,backgroundColor:active?chosen:'transparent',flexDirection:'row',alignItems:'center',gap:8}}>
    {!serviceTitle?<View style={{width:48,height:40,flexShrink:0,alignItems:'center',justifyContent:'center'}}>{im?<Image accessibilityLabel={`${row.name} thumbnail`} source={im} resizeMode="contain" style={{width:48,height:38}}/>:logo?<Image accessibilityLabel={`${row.brand} brand logo`} source={logo.src} resizeMode="contain" style={{width:44,height:28}}/>:<Icon mono name="shield" size={20} color={muted}/>}</View>:null}
    <Text style={[font,{flex:1,minWidth:0,fontSize:12,lineHeight:18,fontWeight:'500'}]}>{optionLabel?optionLabel(row):row.brand&&row.brand!=='Standard'&&row.brand!=='Add-ons'?productDisplayName(row):row.name}</Text>
    <Text style={[font,{fontSize:12,lineHeight:18,fontWeight:'600',width:78,flexShrink:0,textAlign:'right'}]}>{price(row)}</Text>
    <View style={{width:13,flexShrink:0}}>{active?<Icon mono name="check" size={13} color={accent}/>:null}</View>
   </Pressable>})}</View>
   <Text style={[font,{fontSize:10,lineHeight:16,color:muted,marginTop:12}]}>{serviceTitle?'Choose an option to see its details and price. Selection does not book.':'Select a service to read about it. Selection does not book.'}</Text>
  </View>:null}
  {points.length?<View testID="service-detail-points" style={{borderRadius:22,borderWidth:1,borderColor:rule,backgroundColor:colors.surface,padding:16,gap:12}}>
   {points.map((raw,i)=>{const f=productHighlight(raw);return <View key={i} style={{flexDirection:'row',alignItems:'center',gap:12}}>
    <View style={{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:rule,backgroundColor:colors.surface,alignItems:'center',justifyContent:'center'}}><Icon mono name={f.icon} size={16} color={ink}/></View>
    <Text style={[font,{flex:1,fontSize:12,lineHeight:18}]}>{f.text}</Text>
   </View>})}
  </View>:null}
  {s.warrantyLabel?<View style={{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:4}}>
   <View style={{width:34,height:34,borderRadius:17,borderWidth:1,borderColor:rule,backgroundColor:chosen,alignItems:'center',justifyContent:'center'}}><Icon mono name="shield" size={16} color={ink}/></View>
   <View style={{flex:1,gap:2}}><Text style={[font,{fontSize:12,lineHeight:17}]}>{s.warrantyLabel}</Text><Text style={[font,{fontSize:10,lineHeight:15,color:muted}]}>Manufacturer statement. Ask the studio to confirm cover and registration before booking.</Text></View>
  </View>:null}
  {conditions.map((text,i)=><Text key={i} style={[font,{fontSize:10,lineHeight:16,color:muted}]}>Compatibility: {text}</Text>)}
  {care.length?<View testID="service-detail-care" style={{borderRadius:22,borderWidth:1,borderColor:rule,backgroundColor:colors.surface,padding:16,gap:12}}>
   {care.map((tip,i)=><View key={i} style={{flexDirection:'row',alignItems:'flex-start',gap:12}}><View style={{paddingTop:1}}><Icon mono name="shield" size={15} color={muted}/></View><Text style={[font,{flex:1,fontSize:12,lineHeight:19,color:muted}]}>{tip}</Text></View>)}
  </View>:null}
  <View style={{gap:12}}>
   {quote?<Text style={[font,{flex:1,fontSize:11,lineHeight:16,color:muted}]}>Scope and price are agreed after inspection.</Text>:null}
   <View style={{flexDirection:'row',alignItems:'stretch',justifyContent:'flex-end',gap:10}}>
   <Pressable accessibilityRole="button" accessibilityLabel={eligible?(added?'Remove ':'Add ')+s.name:quote?`Discuss requirements for ${s.name}`:`Review booking for ${s.name}`} accessibilityState={eligible?{selected:added}:undefined} onPress={actionPress} style={quote?{flex:1,minWidth:0,minHeight:44,justifyContent:'center'}:undefined}>{({pressed})=><View pointerEvents="none" style={{...serviceActionSurface(name,eligible&&added,pressed),minHeight:quote?36:40,paddingHorizontal:quote?8:18,paddingVertical:quote?3:0,borderRadius:quote?10:12,alignItems:'center',justifyContent:'center',...(quote?{borderColor:colors.borderStrong,backgroundColor:colors.surface}:{})}}>{eligible&&added?<Icon name="close" size={18} color={ink}/>:<Text style={[font,{fontSize:quote?11:12,fontWeight:'600',color:ink,...(quote?{lineHeight:15,textAlign:'center' as const}:{})}]}>{actionLabel}</Text>}</View>}</Pressable>
   {quote?<Pressable accessibilityRole="button" accessibilityLabel={`Full details for ${s.name}`} onPress={()=>onOpen(s)} style={{flex:1,minWidth:0,minHeight:44,justifyContent:'center'}}>{({pressed})=><View pointerEvents="none" style={{...serviceActionSurface(name,false,pressed),minHeight:36,paddingHorizontal:8,paddingVertical:3,borderRadius:10,justifyContent:'center',alignItems:'center'}}><Text style={[font,{fontSize:11,lineHeight:15,color:ink,textAlign:'center'}]}>Full service details</Text></View>}</Pressable>:null}
   </View>
  </View>
  {s.customerMenu?.bookingMode?<Text style={[font,{fontSize:11,lineHeight:16,color:muted}]}>{s.customerMenu.bookingMode==='walk_in'?'Free initial walk-in check. No online slot.':'Specialist timing must be confirmed. No online slot.'}</Text>:null}


 </View>;
}
