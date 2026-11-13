import {Pressable,View}from'react-native';
import{Chip,T}from'./kit';
import{useExperienceTheme}from'@autodeck/ui/native';
/** Compact booking summary. One target, one status, no empty detail lane. */
export function GarageBookingRow({title,detail,status,onPress,last}:{title:string;detail?:string|undefined;status:string;onPress:()=>void;last:boolean}){
const{colors}=useExperienceTheme();return <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${status}`} onPress={onPress} style={({pressed})=>({minHeight:56,paddingVertical:8,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:last?0:1,borderBottomColor:colors.borderSubtle,opacity:pressed?.7:1})}><View style={{flex:1,minWidth:0,gap:4}}><T role="bodyStrong">{title}</T>{detail?<T role="caption" tone="secondary">{detail}</T>:null}</View><Chip label={status.replace(/_/g,' ')} tone={status==='ACTIVE'||status==='CONFIRMED'?'premium':'neutral'}/></Pressable>;
}
