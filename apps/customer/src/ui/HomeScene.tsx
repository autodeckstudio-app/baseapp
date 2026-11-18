import {useState} from 'react';
import {Image,Platform,Pressable,Text,View} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {SERVICE_HOMES} from '@autodeck/core';
import {pickIdleNudge,type HomeViewProps} from './HomeView';
import {HomeOriginalTop} from './HomeOriginalTop';
import {SideDrawer} from './SideDrawer';
import {HomeClub} from './HomeClub';
import {HomeShowroom} from './HomeShowroom';
import {CampaignSlot} from './CampaignSlot';
import {StudioFooterMockup} from './StudioFooterMockup';
import {NavIcon,type NavIconName} from './NavIcon';
import {raised} from '../lib/raised';
const icons:Record<string,NavIconName>={washing:'wash',paint:'ceramic',detailing:'surface',garage:'garage',modifications:'layers'};
/** Every control keeps its connected adapter callback. No preview records or prices enter production. */
export function HomeScene({p}:{p:HomeViewProps}){
 const{name,colors}=useExperienceTheme(),r=raised(name),[menu,setMenu]=useState(false);
 const event=p.live&&!p.live.idle?p.live:null;
 const nudge=event?null:pickIdleNudge({reminder:p.reminders[0]??null,need:p.need,rebook:p.rebook,onReminder:p.onReminders});
 const action=event?(event.kicker==='Needs your OK'?'Review':event.kicker==='Next visit'||event.kicker==='Payment due'?'View':'Track'):nudge?.cta??'Book a service';
 const actionPress=event?.onPress??nudge?.onPress??p.onBook;
 return <View testID="home-scene" style={{gap:18}}>
  {p.drawer?.length?<SideDrawer open={menu} onClose={()=>setMenu(false)} name={p.displayName??'AutoDeck'} initial={p.initial} items={p.drawer}/>:null}
  <HomeOriginalTop p={p} onMenu={()=>p.drawer?.length?setMenu(true):p.onAvatar()}/>
  {event||nudge?<Pressable testID="home-state-dock" accessibilityRole="button" accessibilityLabel={action} onPress={actionPress} style={{...r.card,padding:17,gap:9,marginTop:-10}}>
   <Text style={{fontSize:9,letterSpacing:1.4,textTransform:'uppercase',color:colors.textSecondary}}>{event?.kicker??nudge?.kicker}</Text>
   <View style={{flexDirection:'row',alignItems:'center',gap:12}}><NavIcon cut={colors.surface} name={event?'history':'garage'} color={colors.textSecondary} size={24}/><View style={{flex:1,gap:4}}><Text style={{fontSize:17,lineHeight:23,fontWeight:'600',color:colors.textPrimary}}>{event?.title??nudge?.title}</Text>{event?.detail||nudge?.detail?<Text style={{fontSize:12,lineHeight:18,color:colors.textSecondary}}>{event?.detail??nudge?.detail}</Text>:null}{event?.ready?<Text style={{fontSize:11,color:colors.textSecondary}}>Ready by {event.ready}</Text>:null}</View><Text style={{fontSize:12,color:colors.textPrimary}}>{action}</Text></View>
  </Pressable>:null}
  {p.banner}
  <View style={{gap:18,paddingTop:4}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:10}}><Text accessibilityRole="header" style={{fontSize:22,fontWeight:'600',letterSpacing:-.7,color:colors.textPrimary}}>Care for your car</Text><Pressable accessibilityRole="button" accessibilityLabel="All services" onPress={p.onAllServices} style={{minHeight:44,justifyContent:'center'}}><Text style={{fontSize:12,color:colors.textPrimary}}>View all</Text></Pressable></View>
   <View testID="home-service-shortcuts" style={{flexDirection:'row',gap:7,justifyContent:'space-between'}}>{[...SERVICE_HOMES].sort((a,b)=>['washing','paint','detailing','garage','modifications'].indexOf(a.key)-['washing','paint','detailing','garage','modifications'].indexOf(b.key)).map(h=><Pressable key={h.key} accessibilityRole="button" accessibilityLabel={h.key==='washing'?'Wash & care':h.key==='paint'?'Paint protection':h.key==='modifications'?'Mods & wraps':h.label} onPress={()=>p.onCategory(h.key)} style={{flex:1,minWidth:0,alignItems:'center',gap:9}}><View style={{...r.round,width:47,height:47,alignItems:'center',justifyContent:'center'}}><NavIcon cut={colors.surface} name={icons[h.key]??'services'} color={colors.textPrimary} size={23}/></View><Text style={{fontSize:10,lineHeight:15,textAlign:'center',color:colors.textPrimary}}>{h.key==='modifications'?'Mods & wraps':h.key==='paint'?'Paint protection':h.key==='washing'?'Wash & care':h.label}</Text></Pressable>)}</View>
  </View>
  <HomeClub membership={p.membership} onPress={p.onMembership}/>
  <CampaignSlot campaign={p.campaign}/>
  <View style={{gap:13}}><Text style={{fontSize:20,fontWeight:'600',letterSpacing:-.6,color:colors.textPrimary}}>More from AutoDeck</Text><Pressable accessibilityRole="button" accessibilityLabel="Your car records" onPress={p.onGarage} style={{...r.card,padding:20,flexDirection:'row',alignItems:'center',gap:16}}><NavIcon cut={colors.surface} name="garage" size={27} color={colors.textPrimary}/><View style={{flex:1,gap:6}}><Text style={{fontSize:16,fontWeight:'600',color:colors.textPrimary}}>Your car records</Text><Text style={{fontSize:12,lineHeight:18,color:colors.textSecondary}}>Visits, papers and protection, together.</Text></View></Pressable></View>
  {p.carsList?.length&&p.onOpenCar&&p.onBuyCar&&p.onSellCar?<HomeShowroom cars={p.carsList} onOpen={p.onOpenCar} onBuy={p.onBuyCar} onSell={p.onSellCar}/>:null}
  <View style={{borderTopWidth:1,borderColor:colors.borderSubtle,paddingTop:24,gap:12}}>
   <Pressable accessibilityRole="button" accessibilityLabel={`The studio, ${p.studio.hours}${p.studio.openText?', '+p.studio.openText:''}. Open the studio page`} onPress={p.onStudio} style={{gap:9,minHeight:48}}><Text style={{fontSize:10,letterSpacing:1.5,color:colors.textSecondary}}>THE AUTODECK STUDIO</Text><Text style={{fontSize:24,lineHeight:30,fontWeight:'600',letterSpacing:-.7,color:colors.textPrimary}}>Visit or get in touch</Text>{p.studio.openText?<Text style={{fontSize:12,color:colors.textSecondary}}>{p.studio.openText}</Text>:null}{p.studio.hours?<Text style={{fontSize:12,lineHeight:18,color:colors.textSecondary}}>{p.studio.hours}</Text>:null}</Pressable>
   <StudioFooterMockup/>
   <View testID="home-studio-contacts" style={{flexDirection:'row',justifyContent:'space-between',gap:10,flexWrap:'wrap',paddingTop:6}}>{p.quick?.map(q=><Pressable key={q.key} accessibilityRole="button" accessibilityLabel={q.label} onPress={q.onPress} style={{minWidth:64,minHeight:65,alignItems:'center',gap:8}}><View style={{...r.round,width:44,height:44,alignItems:'center',justifyContent:'center'}}><NavIcon cut={colors.surface} name={q.icon} size={23} color={colors.textPrimary}/></View><Text style={{fontSize:11,color:colors.textPrimary}}>{q.label}</Text></Pressable>)}</View>
   {p.social?.length?<View style={{flexDirection:'row',justifyContent:'center',gap:24}}>{p.social.map(s=><Pressable key={s.key} accessibilityRole="button" accessibilityLabel={s.icon==='channel'?'Channel':s.title} onPress={s.onPress} style={{minHeight:48,minWidth:48,alignItems:'center',justifyContent:'center'}}><NavIcon cut={colors.surface} name={s.icon} size={23} color={colors.textSecondary}/></Pressable>)}</View>:null}
  </View>
 </View>;
}
