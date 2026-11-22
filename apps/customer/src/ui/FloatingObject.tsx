import { Image, Platform, View } from "react-native";
import wash from '../../assets/floating/wash.png';
import protect from '../../assets/floating/protect.png';
import pad from '../../assets/floating/pad.png';
import garage from '../../assets/floating/garage.png';
import layers from '../../assets/floating/layers.png';
import club from '../../assets/floating/club.png';
import gift from '../../assets/floating/gift.png';
import bell from '../../assets/floating/bell.png';
import document from '../../assets/floating/document.png';
import calendar from '../../assets/floating/calendar.png';
import tools from '../../assets/floating/tools.png';
const art={wash,ceramic:protect,surface:pad,garage,layers,club,gift,bell,document,bookings:calendar,services:tools,tools};
export type FloatingObjectName=keyof typeof art;
/** Decorative entry illustration only. Meaning and hit target belong to the parent control. */
export function FloatingObject({name,size=38,width=size,height=size}:{name:FloatingObjectName;size?:number;width?:number;height?:number}){
 return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{width,height,alignItems:'center',justifyContent:'center',...(Platform.OS==='web'?{filter:'drop-shadow(0 3px 2px rgba(0,0,0,.16))'}:{shadowColor:'#000',shadowOpacity:.16,shadowRadius:2,shadowOffset:{width:0,height:3}})}}><Image source={art[name]} resizeMode="contain" style={{width,height}} accessibilityIgnoresInvertColors /></View>;
}
