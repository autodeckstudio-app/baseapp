import { Pressable } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
/** Icon-led entry point. Destructive confirmation and its words remain at the destination. */
export function IconAction({kind,label,onPress,onDark=false}:{kind:"edit"|"delete";label:string;onPress:()=>void;onDark?:boolean}) {
 const {name,colors}=useExperienceTheme();
 return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({pressed})=>({width:48,height:48,alignItems:"center",justifyContent:"center",backgroundColor:"transparent",opacity:pressed?.6:1})}><NavIcon name={kind} color={onDark?"#FFFFFF":colors.textPrimary} size={22} cut={name==="light"?"#FFFFFF":"#252C35"}/></Pressable>;
}
