import { Platform, Pressable, View, type ViewStyle } from "react-native";
import { useExperienceTheme, useReduceTransparency } from "@autodeck/ui/native";
import { material } from "@autodeck/ui/theme";
import { T } from "./kit";
export type PickupOption = "pickup" | "drop" | "both";
const OPTIONS: {value:PickupOption;label:string}[] = [
  {value:"pickup",label:"Pickup"},
  {value:"drop",label:"Drop-off"},
  {value:"both",label:"Both"},
];
/** One label style for every choice. Selection changes the rim, not baseline or weight. */
export function PickupOptions({value,onChange}:{value:PickupOption|null;onChange:(value:PickupOption)=>void}) {
  const {name}=useExperienceTheme();
  const reduce=useReduceTransparency();
  return <View style={{gap:12}}>
    <View testID="pickup-choice-row" style={{flexDirection:"row",flexWrap:"nowrap",gap:8}}>
      {OPTIONS.map(o=><Pressable key={o.value} accessibilityRole="button" accessibilityLabel={o.label} accessibilityState={{selected:value===o.value}} onPress={()=>onChange(o.value)} style={({pressed})=>{
        const m=material(name,"control",{reduce,pressed});
        return {flex:1,minWidth:0,minHeight:48,paddingHorizontal:6,paddingVertical:12,borderRadius:24,borderWidth:1,borderColor:value===o.value?"rgba(194,84,10,.5)":m.edge,backgroundColor:m.fallback,...(Platform.OS==="web"?m.web as ViewStyle:{}),alignItems:"center",justifyContent:"center",...(value===o.value?{borderColor:"rgba(194,84,10,.5)"}:{})};
      }}><T role="bodyStrong" numberOfLines={1} style={{fontSize:14,lineHeight:20,fontWeight:"600",letterSpacing:0,textAlign:"center",includeFontPadding:false,textAlignVertical:"center",flexShrink:1}}>{o.label}</T></Pressable>)}
    </View>
  </View>;
}
