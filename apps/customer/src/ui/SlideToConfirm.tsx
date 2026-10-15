import { useRef, useState } from "react";
import { Animated, PanResponder, Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";

const THUMB = 52;
const PAD = 4;
/** A slide-to-confirm bar. Dragging the thumb to the end confirms. A plain tap fallback sits underneath so a failed swipe never blocks the customer. */
export function SlideToConfirm({ label, onConfirm, busy = false, disabled = false }: { label: string; onConfirm: () => void; busy?: boolean; disabled?: boolean }) {
  const { name: mode, colors } = useExperienceTheme();
  const day = mode === "light";
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;
  const max = Math.max(0, w - THUMB - PAD * 2);
  const live = useRef({ max: 0, off: false, fire: () => undefined as void });
  live.current = { max, off: disabled || busy, fire: onConfirm };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !live.current.off,
      onMoveShouldSetPanResponder: () => !live.current.off,
      onPanResponderMove: (_e, g) => x.setValue(Math.min(Math.max(0, g.dx), live.current.max)),
      onPanResponderRelease: (_e, g) => {
        if (live.current.max > 0 && g.dx >= live.current.max * 0.85) {
          Animated.timing(x, { toValue: live.current.max, duration: 80, useNativeDriver: false }).start(() => { live.current.fire(); setTimeout(() => x.setValue(0), 600); });
        } else Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();
      },
    }),
  ).current;
  const fillW = Animated.add(x, THUMB + PAD);
  return (
    <View style={{ gap: 8 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: THUMB + PAD * 2, borderRadius: 9999, backgroundColor: day ? "#16181C" : "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", justifyContent: "center", overflow: "hidden", opacity: disabled ? 0.5 : 1 }}>
        <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: fillW, borderRadius: 9999, backgroundColor: "rgba(244,242,239,0.16)" }} />
        <Text pointerEvents="none" style={{ textAlign: "center", color: "#F4F2EF", fontSize: 15, fontWeight: "700", paddingLeft: THUMB / 2 }}>{busy ? "Sending..." : label}</Text>
        <Animated.View {...pan.panHandlers} accessibilityRole="button" accessibilityLabel={label} style={{ position: "absolute", left: PAD, top: PAD, width: THUMB, height: THUMB, borderRadius: 9999, backgroundColor: "#F4F2EF", alignItems: "center", justifyContent: "center", transform: [{ translateX: x }] }}>
          <Text style={{ color: "#0B0B0D", fontSize: 22, fontWeight: "800" }}>{"\u203A"}</Text>
        </Animated.View>
      </View>
      <Pressable accessibilityRole="button" disabled={disabled || busy} onPress={onConfirm} hitSlop={8} style={{ alignSelf: "center", minHeight: 36, justifyContent: "center" }}>
        <Text style={{ color: day ? colors.textSecondary : "#C9C6C1", fontSize: 13, fontWeight: "600" }}>Or tap here to confirm</Text>
      </Pressable>
    </View>
  );
}
