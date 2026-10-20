import { useMemo, useRef } from "react";
import { PanResponder, type ViewStyle } from "react-native";
import { SWIPE_AXIS_RATIO, swipeTarget } from "./segment-swipe-core";

export { swipeTarget } from "./segment-swipe-core";

/** Pan handlers that only claim a mostly horizontal drag, so vertical scrolling and taps keep working. */
export function useSegmentSwipe<K extends string>(keys: readonly K[], getCurrent: () => K, onChange: (k: K) => void) {
  const latest = useRef({ keys, getCurrent, onChange });
  latest.current = { keys, getCurrent, onChange };
  return useMemo(() => {
    const pan = PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * SWIPE_AXIS_RATIO,
      onPanResponderRelease: (_e, g) => {
        const { keys: k, getCurrent: gc, onChange: cb } = latest.current;
        const t = swipeTarget(k, gc(), g.dx, g.dy);
        if (t) cb(t);
      },
    });
    const style = { touchAction: "pan-y" } as unknown as ViewStyle;
    return { handlers: pan.panHandlers, style };
  }, []);
}
