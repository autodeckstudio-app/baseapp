// One place that says whether the customer asked for less motion (device setting, or the browser's prefers-reduced-motion).
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduce(v));
    let mq: MediaQueryList | null = null;
    const onMq = () => { if (mq) setReduce(mq.matches); };
    if (Platform.OS === "web" && typeof window !== "undefined" && window.matchMedia) {
      mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) setReduce(true);
      mq.addEventListener?.("change", onMq);
    }
    return () => { alive = false; sub.remove(); mq?.removeEventListener?.("change", onMq); };
  }, []);
  return reduce;
}
