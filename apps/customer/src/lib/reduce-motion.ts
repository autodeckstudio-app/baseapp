// One place that says whether the customer asked for less motion: the device setting OR the browser's
// prefers-reduced-motion. Either one is enough, and neither can switch the other off.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { combineReduce } from "./reduce-motion-core";

type MQ = { matches: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };

export function useReduceMotion(): boolean {
  const [device, setDevice] = useState(false);
  const [media, setMedia] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive) setDevice(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => setDevice(v));
    const w = globalThis as unknown as { matchMedia?: (q: string) => MQ };
    let mq: MQ | null = null;
    const onMq = () => { if (mq) setMedia(mq.matches); };
    if (Platform.OS === "web" && w.matchMedia) {
      mq = w.matchMedia("(prefers-reduced-motion: reduce)");
      setMedia(mq.matches);
      mq.addEventListener?.("change", onMq);
    }
    return () => { alive = false; sub.remove(); mq?.removeEventListener?.("change", onMq); };
  }, []);
  return combineReduce(device, media);
}
