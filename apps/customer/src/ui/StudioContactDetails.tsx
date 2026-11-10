import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { Pane, Row, T } from "./kit";
/** One directions entry, using the existing verified maps destination. */
export function StudioContactDetails({address,hours,openNow,onDirections}:{address:string;hours:string;openNow:boolean|null;onDirections?:(()=>void)|undefined}){
 const {colors,name}=useExperienceTheme();
 return <Pane pad="gap"><View style={{gap:8}}>{openNow!==null?<T role="label" tone="accent">{openNow?"OPEN NOW":"CLOSED NOW"}</T>:null}<Row title="AutoDeck Studio" onPress={onDirections} trailing={<NavIcon name="directions" color={colors.textPrimary} size={22} cut={name==="light"?"#FFFFFF":"#18181C"}/>} last/><View accessible accessibilityLabel={address} style={{gap:4,paddingHorizontal:12,paddingBottom:12}}>{address.split(",").map((part,i)=><T key={`${i}:${part}`} role="caption" tone="secondary">{part.trim()}</T>)}</View>{hours?<View style={{gap:6,paddingHorizontal:12,paddingTop:10}}><T role="heading">Opening hours</T>{hours.split(/\.\s+/).filter(Boolean).map((line,i)=><T key={`${i}:${line}`} role="caption" tone="secondary">{line}</T>)}</View>:null}</View></Pane>;
}
