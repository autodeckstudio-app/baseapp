import{useEffect,useRef,type ReactNode}from'react';
import{AccessibilityInfo,Animated,Easing,Platform}from'react-native';
/** Shared quiet entrance, not a simulated car model. Touch scrolling stays native. */
export function SceneMotion({children,identity}:{children:ReactNode;identity:string}){
 const value=useRef(new Animated.Value(1)).current;
 useEffect(()=>{let alive=true;const settle=(reduce:boolean)=>{if(!alive)return;value.setValue(reduce?1:0);if(!reduce)Animated.timing(value,{toValue:1,duration:420,easing:Easing.out(Easing.cubic),useNativeDriver:Platform.OS!=='web'}).start()};
 if(Platform.OS==='web'){const q=(globalThis as {matchMedia?:(q:string)=>{matches:boolean;addEventListener?:(event:string,callback:()=>void)=>void;removeEventListener?:(event:string,callback:()=>void)=>void}}).matchMedia?.('(prefers-reduced-motion: reduce)');settle(q?.matches??true);const change=()=>settle(q?.matches??true);q?.addEventListener?.('change',change);return()=>{alive=false;q?.removeEventListener?.('change',change);value.stopAnimation()}}
 void AccessibilityInfo.isReduceMotionEnabled().then(settle).catch(()=>settle(true));const sub=AccessibilityInfo.addEventListener('reduceMotionChanged',settle);return()=>{alive=false;sub.remove();value.stopAnimation()};
 },[identity,value]);
 return <Animated.View style={{width:'100%',minWidth:0,opacity:value,transform:[{translateY:value.interpolate({inputRange:[0,1],outputRange:[10,0]})}]}}>{children}</Animated.View>;
}
