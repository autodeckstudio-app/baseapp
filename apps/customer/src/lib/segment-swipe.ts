import { useMemo, useRef } from "react";
import { PanResponder, type ViewStyle } from "react-native";
import { SWIPE_AXIS_RATIO, swipeTarget } from "./segment-swipe-core";

export { swipeTarget } from "./segment-swipe-core";

/** Pan handlers that only claim a mostly horizontal drag, so vertical scrolling and taps keep working. */
export function useSegmentSwipe<K extends string>(keys: readonly K[], current: K, onChange: (k: K) => void) {
  const latest = useRef({ keys, current, onChange });
  latest.current = { keys, current, onChange };
  return useMemo(() => {
    const pan = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * SWIPE_AXIS_RATIO,
      onPanResponderRelease: (_e, g) => {
        const { keys: k, current: c, onChange: cb } = latest.current;
        const t = swipeTarget(k, c, g.dx, g.dy);
        if (t) cb(t);
      },
    });
    const style = { touchAction: "pan-y" } as unknown as ViewStyle;
    return { handlers: pan.panHandlers, style };
  }, []);
}
