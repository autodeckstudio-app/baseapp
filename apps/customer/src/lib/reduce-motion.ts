// One place that says whether the customer asked for less motion (device setting, or the browser's prefers-reduced-motion).
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setReduce(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setReduce(v));
    type MQ = { matches: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };
    const w = globalThis as unknown as { matchMedia?: (q: string) => MQ };
    let mq: MQ | null = null;
    const onMq = () => { if (mq) setReduce(mq.matches); };
    if (Platform.OS === "web" && w.matchMedia) {
      mq = w.matchMedia("(prefers-reduced-motion: reduce)");
      if (mq.matches) setReduce(true);
      mq.addEventListener?.("change", onMq);
    }
    return () => { alive = false; sub.remove(); mq?.removeEventListener?.("change", onMq); };
  }, []);
  return reduce;
}
