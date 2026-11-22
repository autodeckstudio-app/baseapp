import { Image, Pressable, View } from "react-native";
import { Pane, T } from "./kit";
import {useStudioFrontage} from "./StudioFooterMockup";
import locationMap from "../../assets/studio/studio-location-map.jpg";
/** Same promotional Home imagery/timing, with a genuine website map. */
export function StudioContactDetails({address,hours,openNow,onDirections}:{address:string;hours:string;openNow:boolean|null;onDirections?:(()=>void)|undefined}){
 const {source,period}=useStudioFrontage();
 const parts=address.split(",").map(s=>s.trim());
 return <Pane pad="inset"><View style={{gap:10}}>
  <T role="heading">AutoDeck Studio</T>
  <View style={{borderRadius:12,overflow:"hidden"}}><Image source={source} accessibilityLabel={`AutoDeck studio frontage, ${period}, promotional reconstruction`} resizeMode="contain" style={{width:"100%",aspectRatio:1155/438}}/>{openNow!==null?<View style={{position:"absolute",right:6,bottom:6,backgroundColor:"rgba(20,25,30,.86)",paddingHorizontal:6,paddingVertical:3,borderRadius:6}}><T role="label" style={{color:"#ffffff",fontSize:10}}>{openNow?"OPEN NOW":"CLOSED NOW"}</T></View>:null}</View>
  <T role="caption" tone="secondary" style={{fontSize:10}}>Studio promotional image</T>
  <View accessible accessibilityLabel={address} style={{gap:3}}><T role="caption" tone="secondary">{parts.slice(0,2).join(", ")}</T><T role="caption" tone="secondary">{parts.slice(2).join(", ")}</T></View>
  <View style={{flexDirection:"row",alignItems:"center",gap:10}}>
   {hours?<View accessibilityLabel="Opening hours" style={{flex:1,minWidth:0,gap:3}}>{hours.split(/\.\s+/).filter(Boolean).map((line,i)=><T key={i} role="caption" tone="secondary">{line}</T>)}</View>:null}
   <Pressable accessibilityRole="button" accessibilityLabel="Directions to AutoDeck Studio" onPress={onDirections} style={{width:88,minHeight:60,gap:3}}><Image source={locationMap} accessibilityLabel="Google map of AutoDeck near Netaji Road and Gujarat College Road" resizeMode="contain" style={{width:88,height:44,borderRadius:8}}/><T role="caption" tone="secondary" style={{fontSize:10,textAlign:"center"}}>Google Maps</T></Pressable>
  </View>
 </View></Pane>;
}
