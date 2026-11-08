// One place that says whether the customer asked for less motion: the device setting OR the browser's
// prefers-reduced-motion. Either one is enough, and neither can switch the other off.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

import { combineReduce } from "./reduce-motion-core";

type MQ = { matches: boolean; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void };

export function useReduceMotion(): boolean {
  // Stay still until the native preference is known; web media is available synchronously.
  const [device, setDevice] = useState(Platform.OS !== "web");
  const [media, setMedia] = useState(() => {
    const w = globalThis as unknown as { matchMedia?: (q: string) => MQ };
    return Platform.OS === "web" && !!w.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    let alive = true;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive && !changed) setDevice(v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => {
      if (!alive) return;
      changed = true;
      setDevice(v);
    });
    const w = globalThis as unknown as { matchMedia?: (q: string) => MQ };
    let mq: MQ | null = null;
    const onMq = () => { if (mq) setMedia(mq.matches); };
    if (Platform.OS === "web" && w.matchMedia) {
      mq = w.matchMedia("(prefers-reduced-motion: reduce)");
      setMedia(mq.matches);
      mq.addEventListener?.("change", onMq);
    }
    return () => { alive = false; sub?.remove?.(); mq?.removeEventListener?.("change", onMq); };
  }, []);
  return combineReduce(device, media);
}
