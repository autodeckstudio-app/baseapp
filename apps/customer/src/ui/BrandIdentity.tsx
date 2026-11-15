import { Image, View } from "react-native";
import { BRAND_LOGOS } from "../lib/brand-logos";
import { T } from "./kit";
export function BrandIdentity({brand}:{brand:string|null|undefined}) {
 if(!brand?.trim())return null;
 const logo=BRAND_LOGOS[brand];
 return <View style={{flexDirection:"row",alignItems:"center",gap:8,flexWrap:"wrap"}}>{logo?<View style={{width:72,height:32,padding:5,borderRadius:6,backgroundColor:logo.background}}><Image accessibilityLabel={`${brand} logo`} source={logo.src} resizeMode="contain" style={{width:"100%",height:"100%"}}/></View>:null}<T role="caption" tone="secondary">{brand==="Add-ons"?"Optional extra":brand}</T></View>;
}
