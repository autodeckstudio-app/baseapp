import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { Pane, Row, T } from "./kit";
/** One directions entry, using the existing verified maps destination. */
export function StudioContactDetails({address,hours,openNow,onDirections}:{address:string;hours:string;openNow:boolean|null;onDirections?:(()=>void)|undefined}){
 const {colors,name}=useExperienceTheme();
 return <Pane pad="gap"><View style={{gap:8}}>{openNow!==null?<T role="label" tone="accent">{openNow?"OPEN NOW":"CLOSED NOW"}</T>:null}<Row title="AutoDeck Studio" detail={address} onPress={onDirections} trailing={<NavIcon name="directions" color={colors.textPrimary} size={22} cut={name==="light"?"#FFFFFF":"#18181C"}/>} last={!hours}/>{hours?<Row title="Opening hours" detail={hours} last/>:null}</View></Pane>;
}
