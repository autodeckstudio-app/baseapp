import type{ReactNode}from'react';import{Platform,Text,View}from'react-native';import{useExperienceTheme}from'@autodeck/ui/native';
/** Shared editorial heading for the Garage and Services journey, including detail/forms. Eyebrow renders only when it adds context beyond any breadcrumb. */
export function SceneIntro({eyebrow,title,detail,media,compact=false}:{eyebrow:string;title:string;detail?:string;media?:ReactNode;compact?:boolean}){
 const{colors,name}=useExperienceTheme();
 const brow=eyebrow?<Text style={{color:media?'#FFF':colors.premium,fontSize:media?11:10,letterSpacing:2,fontWeight:'700'}}>{eyebrow.toUpperCase()}</Text>:null;
 return <View style={{width:'100%',minWidth:0,gap:12}}>
  {media?<View style={{height:compact?180:230,borderRadius:28,overflow:'hidden',borderWidth:1,borderColor:colors.borderSubtle,backgroundColor:name==='light'?'#E5E4E0':'#191A20'}}>{media}<View pointerEvents="none" style={{position:'absolute',inset:0,...(Platform.OS==='web'?{backgroundImage:'linear-gradient(180deg,transparent 35%,rgba(0,0,0,.6) 100%)'}:{backgroundColor:'rgba(0,0,0,.12)'})} as never}/>{brow?<View style={{position:'absolute',left:20,bottom:18,right:20}}>{brow}</View>:null}</View>:brow}
  <Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:compact?28:36,lineHeight:compact?32:39,fontWeight:'600',letterSpacing:-1.3}}>{title}</Text>
  {detail?<Text style={{color:colors.textSecondary,fontSize:14,lineHeight:21,maxWidth:440}}>{detail}</Text>:null}
 </View>;
}
