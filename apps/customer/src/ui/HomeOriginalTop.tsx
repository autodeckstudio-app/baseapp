import wordmarkLight from '../../assets/brand/wordmark-light.png';
import wordmarkDark from '../../assets/brand/wordmark-dark.png';
import hero from '../../assets/imagery/hero-home.jpg';
import {Image,Platform,Pressable,Text,View} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {NavIcon} from './NavIcon';
import {HomeOwnedCars} from './HomeOwnedCars';
import {raised} from '../lib/raised';
import type {HomeViewProps} from './HomeView';
/** Connected Home identity, stories, service hero and canonical owned-car selector. */
export function HomeOriginalTop({p,onMenu}:{p:HomeViewProps;onMenu:()=>void}){
 const{name,colors}=useExperienceTheme(),r=raised(name);
 return <View testID="home-original-top" style={{gap:18}}>
  <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,paddingBottom:8}}>
   <Image testID="home-official-wordmark" accessibilityLabel="AutoDeck" source={name==='light'?wordmarkLight:wordmarkDark} resizeMode="contain" style={{width:164,maxWidth:'52%',height:24}}/>
   <View style={{flexDirection:'row',gap:10}}>
    <Pressable accessibilityRole="button" accessibilityLabel={p.unread>0?`Notifications, ${p.unread} unread`:'Notifications'} onPress={p.onBell} style={{...r.round,width:44,height:44,alignItems:'center',justifyContent:'center'}}><NavIcon cut={colors.surface} name="bell" color={colors.textPrimary} size={22}/>{p.unread>0?<View style={{position:'absolute',right:10,top:9,width:6,height:6,borderRadius:3,backgroundColor:colors.accent}}/>:null}</Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={onMenu} style={{...r.round,width:44,height:44,alignItems:'center',justifyContent:'center'}}><Text style={{color:colors.textPrimary,fontSize:17,fontWeight:'600'}}>{p.initial}</Text></Pressable>
   </View>
  </View>
  <View style={{gap:8}}><Text testID="home-greeting" style={{color:colors.textSecondary,fontSize:10,letterSpacing:1.6,textTransform:'uppercase'}}>{p.greeting}</Text><Text accessibilityRole="header" style={{fontSize:30,lineHeight:37,fontWeight:'600',letterSpacing:-1.2,color:colors.textPrimary}}>Welcome to AutoDeck</Text></View>
  {p.stories}
  <Pressable accessibilityRole="button" accessibilityLabel="Explore services" onPress={p.onAllServices} style={{height:170,borderRadius:28,overflow:'hidden',backgroundColor:'#19232d'}}>
   <Image source={hero} accessibilityLabel="Illustrative car photography" resizeMode="cover" style={{position:'absolute',width:'100%',height:'100%'}}/>
   <View pointerEvents="none" style={{position:'absolute',inset:0,backgroundColor:'#08121a25',...(Platform.OS==='web'?{backgroundImage:'linear-gradient(180deg,transparent,#0c1722bb)'} as object:{})}}/>
   <View style={{padding:16,flex:1,justifyContent:'space-between',alignItems:'flex-start'}}><Text style={{fontSize:9,letterSpacing:1,backgroundColor:'#eef3f5de',color:'#252c32',paddingHorizontal:12,paddingVertical:7,borderRadius:20}}>DETAILING & CAR CARE</Text><View style={{flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',gap:12,width:'100%'}}><Text style={{flexShrink:1,fontSize:23,lineHeight:26,fontWeight:'500',letterSpacing:-.8,color:'#fff'}}>{'Car care &\ndetailing'}</Text><View style={{backgroundColor:'#f7f9fb',paddingHorizontal:20,paddingVertical:14,borderRadius:24}}><Text style={{fontSize:13,fontWeight:'600',color:'#252c32'}}>Explore services</Text></View></View></View>
  </Pressable>
  <HomeOwnedCars p={p}/>
 </View>;
}
