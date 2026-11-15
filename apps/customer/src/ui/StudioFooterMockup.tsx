import React from'react';
import{Image,View,Text}from'react-native';
import{useExperienceTheme}from'@autodeck/ui/native';
import{textStyle}from'./kit';
import photo from'../../assets/studio/studio-front-night.png';
export function StudioFooterMockup(){const{colors}=useExperienceTheme();return <View testID='home-studio-mockup' style={{width:'100%',marginTop:20,gap:8}}><View style={{width:'100%',aspectRatio:1155/438,borderRadius:24,overflow:'hidden'}}><Image source={photo} accessibilityLabel='AutoDeck studio frontage, promotional reconstruction' resizeMode='contain' style={{position:'absolute',top:0,left:0,width:'100%',height:'100%'}}/></View><Text style={{...textStyle('caption'),color:colors.textSecondary,fontSize:10,lineHeight:15}}>Studio promotional image</Text></View>}
