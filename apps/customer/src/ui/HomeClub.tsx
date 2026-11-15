import { Image, Platform, Pressable, Text, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useExperienceTheme } from '@autodeck/ui/native';
import { sceneImagery } from '../lib/imagery';
import { textStyle } from './kit';
import type { HomeViewProps } from './HomeView';
import wordmark from '../../assets/brand/wordmark-dark.png';
/** One membership entrance. No invented benefits, pricing or visit allowances. */
export function HomeClub({membership,onPress}:{membership:HomeViewProps['membership'];onPress:()=>void}) {
 const {colors}=useExperienceTheme();const {width}=useWindowDimensions();
 return <View testID="home-club" style={{paddingVertical:26,gap:16}}>
 <View style={{gap:8}}><Text style={{...textStyle('label'),color:colors.accentStrong}}>Autodeck Club</Text><Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.75} style={{...textStyle('title'),fontSize:width<340?22:26,lineHeight:34,color:colors.textPrimary}}>Make care a habit</Text></View>
 <Pressable accessibilityRole="button" accessibilityLabel={membership?'View membership':'Explore the Club'} onPress={onPress} style={({pressed})=>({minHeight:226,borderRadius:24,overflow:'hidden',backgroundColor:'#161D22',opacity:pressed?.88:1})}>
 <Image source={sceneImagery.membership} resizeMode="cover" style={{position:'absolute',right:0,top:0,bottom:0,width:'57%',opacity:.8}}/>
 <View pointerEvents="none" style={{position:'absolute',inset:0,...(Platform.OS==='web'?{backgroundImage:'linear-gradient(90deg,#161D22 8%,#161D22e6 43%,#161D2240 100%)'} as ViewStyle:{backgroundColor:'#161D2266'})}}/>
 <View style={{padding:20,minHeight:226,justifyContent:'space-between',gap:22}}>
 <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Image source={wordmark} resizeMode="contain" style={{width:108,height:16}}/><Text style={{...textStyle('label'),color:'#FFFFFF',fontSize:10,letterSpacing:2}}>CLUB</Text></View>
 <View style={{gap:8,maxWidth:'78%'}}><Text style={{...textStyle('title'),color:'#FFFFFF',fontSize:22,lineHeight:28}}>{membership?membership.title:'A place for\nregular care'}</Text><Text style={{...textStyle('caption'),color:'#DBDFE2',fontSize:12,lineHeight:18}}>{membership?membership.detail:'Explore the wash plans'}</Text></View>
 <View style={{alignSelf:'flex-start',borderBottomWidth:1,borderColor:'#EC8638',paddingBottom:5}}><Text style={{...textStyle('caption'),color:'#FFFFFF',fontSize:12}}>{membership?'View membership':'Explore the Club'}</Text></View>
 </View></Pressable></View>;
}
