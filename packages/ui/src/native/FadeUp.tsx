import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Platform } from "react-native";

/** Soft rise-and-fade entrance. Keep delays small and stagger only the first few items. */
export function FadeUp({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive=true;
    const enter = (reduce:boolean) => {if (!alive) return; if (reduce) v.setValue(1); else Animated.timing(v,{toValue:1,duration:380,delay,useNativeDriver:Platform.OS!=="web"}).start();};
    if (Platform.OS==="web") enter(!!(globalThis as {matchMedia?:(q:string)=>{matches:boolean}}).matchMedia?.("(prefers-reduced-motion: reduce)").matches);
    else void AccessibilityInfo.isReduceMotionEnabled().then(enter);
    return () => {alive=false;v.stopAnimation();};
  }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }}>{children}</Animated.View>;
}
