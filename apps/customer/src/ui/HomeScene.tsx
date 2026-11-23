import { FloatingObject } from "./FloatingObject";
import {Image,Platform,Pressable,Text,View} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {SERVICE_HOMES} from '@autodeck/core';
import {pickIdleNudge,type HomeViewProps} from './HomeView';
import {HomeOriginalTop} from './HomeOriginalTop';
import {HomeClub} from './HomeClub';
import {HomeShowroom} from './HomeShowroom';
import {CampaignSlot} from './CampaignSlot';
import {StudioFooterMockup} from './StudioFooterMockup';
import {NavIcon,type NavIconName} from './NavIcon';
import {raised} from '../lib/raised';
const icons:Record<string,NavIconName>={washing:'wash',paint:'ceramic',detailing:'surface',garage:'garage',modifications:'layers'};
/** Every control keeps its connected adapter callback. No preview records or prices enter production. */
export function HomeScene({p}:{p:HomeViewProps}){
 const{name,colors}=useExperienceTheme(),r=raised(name);
 const event=p.live&&!p.live.idle?p.live:null;
 const nudge=event?null:pickIdleNudge({reminder:p.reminders[0]??null,need:p.need,rebook:p.rebook,onReminder:p.onReminders});
 const action=event?(event.kicker==='Needs your OK'?'Review':event.kicker==='Next visit'||event.kicker==='Payment due'?'View':'Track'):nudge?.cta??'Book a service';
 const actionPress=event?.onPress??nudge?.onPress??p.onBook;
 return <View testID="home-scene" style={{gap:18}}>
  <HomeOriginalTop p={p}/>
  {event||nudge?<Pressable testID="home-state-dock" accessibilityRole="button" accessibilityLabel={action} onPress={actionPress} style={{...r.card,padding:17,gap:9,marginTop:-10}}>
   <Text style={{fontSize:9,letterSpacing:1.4,textTransform:'uppercase',color:colors.textSecondary}}>{event?.kicker??nudge?.kicker}</Text>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}><NavIcon cut={colors.surface} name={event?'history':'garage'} color={colors.textSecondary} size={24}/><View style={{flex:1,gap:4}}><Text style={{fontSize:17,lineHeight:23,fontWeight:'600',color:colors.textPrimary}}>{event?.title??nudge?.title}</Text>{event?.detail||nudge?.detail?<Text style={{fontSize:12,lineHeight:18,color:colors.textSecondary}}>{event?.detail??nudge?.detail}</Text>:null}{event?.ready?<Text style={{fontSize:11,color:colors.textSecondary}}>Ready by {event.ready}</Text>:null}</View><Text style={{fontSize:12,color:colors.textPrimary}}>{action}</Text></View>
  </Pressable>:null}
  {p.banner}
  <View style={{gap:18,paddingTop:4}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}}><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'600',letterSpacing:-.7,color:colors.textPrimary}}>Care for your car</Text><Pressable accessibilityRole="button" accessibilityLabel="All services" onPress={p.onAllServices} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontSize:12,color:colors.textPrimary}}>View all</Text></Pressable></View>
   <View testID="home-service-shortcuts" style={{flexDirection:'row',gap:7,justifyContent:'space-between'}}>{[...SERVICE_HOMES].sort((a,b)=>['washing','paint','detailing','garage','modifications'].indexOf(a.key)-['washing','paint','detailing','garage','modifications'].indexOf(b.key)).map(h=><Pressable key={h.key} accessibilityRole="button" accessibilityLabel={h.key==='washing'?'Wash & care':h.key==='paint'?'Protection':h.key==='modifications'?'Modifications':h.label} onPress={()=>p.onCategory(h.key)} style={{flex:1,minWidth:0,alignItems:'center',minHeight:75,gap:8}}><View style={{width:44,height:52,alignItems:'center',justifyContent:'center'}}><FloatingObject name={h.key==='washing'?'wash':h.key==='paint'?'ceramic':h.key==='detailing'?'surface':h.key==='garage'?'garage':'layers'} width={44} height={48}/></View><Text style={{fontSize:10,lineHeight:15,textAlign:'center',color:colors.textPrimary}}>{h.key==='modifications'?'Modifications':h.key==='paint'?'Protection':h.key==='washing'?'Wash & care':h.label}</Text></Pressable>)}</View>
  </View>
  <HomeClub membership={p.membership} onPress={p.onMembership}/>
  <CampaignSlot campaign={p.campaign}/>
  <View style={{gap:13}}><Text style={{fontSize:20,fontWeight:'600',letterSpacing:-.6,color:colors.textPrimary}}>More from AutoDeck</Text><Pressable accessibilityRole="button" accessibilityLabel="Your car records" onPress={p.onGarage} style={{...r.card,padding:20,flexDirection:'row',alignItems:'center',gap:16}}><FloatingObject name="garage" size={34}/><View style={{flex:1,gap:6}}><Text style={{fontSize:16,fontWeight:'600',color:colors.textPrimary}}>Your car records</Text><Text style={{fontSize:12,lineHeight:18,color:colors.textSecondary}}>Visits, papers and protection, together.</Text></View></Pressable></View>
  {p.carsList?.length&&p.onOpenCar&&p.onBuyCar&&p.onSellCar?<HomeShowroom cars={p.carsList} onOpen={p.onOpenCar} onBuy={p.onBuyCar} onSell={p.onSellCar}/>:null}
  <View style={{borderTopWidth:1,borderColor:colors.borderSubtle,paddingTop:24,gap:12}}>
   <Pressable accessibilityRole="button" accessibilityLabel={`The studio, ${p.studio.hours}${p.studio.openText?', '+p.studio.openText:''}. Open the studio page`} onPress={p.onStudio} style={{gap:9,minHeight:48}}><Text style={{fontSize:10,letterSpacing:1.5,color:colors.textSecondary}}>THE AUTODECK STUDIO</Text><View style={{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between',gap:10}}><Text style={{flex:1,minWidth:0,fontSize:24,lineHeight:30,fontWeight:'600',letterSpacing:-.7,color:colors.textPrimary}}>Visit or get in touch</Text>{p.studio.openText?<Text style={{flexShrink:0,fontSize:12,fontWeight:'600',color:p.studio.open===true?(name==='light'?'#1F7A4D':'#7DDBAA'):p.studio.open===false?colors.danger:colors.textSecondary}}>{p.studio.openText}</Text>:null}</View>{p.studio.hours?<Text style={{fontSize:12,lineHeight:18,color:colors.textSecondary}}>{p.studio.hours}</Text>:null}</Pressable>
   <StudioFooterMockup/>
   {/* One themed row: the three contact actions and the two social links share one style (Meet, 19 Nov 2026). */}
   <View testID="home-studio-contacts" style={{flexDirection:'row',justifyContent:'space-between',gap:6,paddingTop:6}}>{[...(p.quick??[]).map(q=>({key:q.key,label:q.label,icon:q.icon,onPress:q.onPress})),...(p.social??[]).map(s=>({key:s.key,label:s.icon==='channel'?'Channel':s.title,icon:s.icon,onPress:s.onPress}))].map(b=><Pressable key={b.key} accessibilityRole="button" accessibilityLabel={b.label} onPress={b.onPress} style={{minWidth:56,minHeight:65,alignItems:'center',gap:8,flexShrink:1}}><View style={{...r.round,width:44,height:44,alignItems:'center',justifyContent:'center'}}><NavIcon cut={colors.surface} name={b.icon} size={22} color={colors.textPrimary}/></View><Text numberOfLines={1} style={{fontSize:11,color:colors.textPrimary}}>{b.label}</Text></Pressable>)}</View>
  </View>
 </View>;
}
