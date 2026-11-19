import {Pressable,Text,View} from 'react-native';
import {createContext,useContext} from 'react';
import {useExperienceTheme} from '@autodeck/ui/native';
/** Shared page hierarchy, matching the Customer root header without changing each page's content layout. */
export const ServiceHeaderHidden=createContext(false);
export function ServicePageHeader({title,detail,context,crumbs=[]}:{title:string;detail?:string|undefined;context?:string|undefined;crumbs?:{title:string;onPress:()=>void}[]}){
 const hidden=useContext(ServiceHeaderHidden);const{colors}=useExperienceTheme();if(hidden)return null;
 const parents=crumbs.filter((c,i)=>i===0||c.title.toLowerCase()!==title.toLowerCase());
 return <View style={{gap:8,minWidth:0,paddingBottom:8}}>
  {parents.length?<View accessibilityLabel="Service path" style={{flexDirection:'row',flexWrap:'wrap',alignItems:'center',columnGap:8}}>{parents.map((c,i)=><View key={`${c.title}-${i}`} style={{flexDirection:'row',alignItems:'center',gap:8}}>{i?<Text style={{color:colors.textTertiary,fontSize:12}}>/</Text>:null}<Pressable accessibilityRole="button" accessibilityLabel={c.title} onPress={c.onPress} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:colors.textSecondary,fontSize:12,lineHeight:18}}>{c.title}</Text></Pressable></View>)}</View>:null}
  <View style={{minWidth:0,gap:6}}>
   {context?<Text style={{color:colors.textSecondary,fontSize:10,lineHeight:14,fontWeight:'600',letterSpacing:.8}}>{context.toUpperCase()}</Text>:null}
   <Text accessibilityRole="header" style={{color:colors.textPrimary,fontSize:22,lineHeight:28,fontWeight:'700',letterSpacing:-.3}}>{title}</Text>
   {detail?<Text style={{color:colors.textSecondary,fontSize:14,lineHeight:21}}>{detail}</Text>:null}
  </View>
 </View>;
}
