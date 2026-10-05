// Light motion helpers for the pre-login screens. Plain Animated, no extra libraries.
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Image, Platform, View, type ImageSourcePropType, type ViewStyle } from "react-native";

export const reducedMotion = (): boolean => Platform.OS === "web" && !!(globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function useLoop(ms: number): Animated.Value {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion()) return;
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(v, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
    ]));
    l.start();
    return () => l.stop();
  }, [v, ms]);
  return v;
}

/** Full-bleed photo that slowly pushes in. */
export function KenBurns({ source, style }: { source: ImageSourcePropType; style?: ViewStyle }) {
  const t = useLoop(16000);
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: -30, right: -30, top: -30, bottom: -30, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }, { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] }) }] }, style]}>
      <Image source={source} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
    </Animated.View>
  );
}

/** A soft glowing orb that floats around. */
export function Orb({ size, color, x, y, dx = 30, dy = 24, ms = 9000 }: { size: number; color: string; x: string; y: string; dx?: number; dy?: number; ms?: number }) {
  const t = useLoop(ms);
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", left: x as unknown as number, top: y as unknown as number, width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-dx, dx] }) }, { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [dy, -dy] }) }], ...(Platform.OS === "web" ? ({ filter: `blur(${Math.round(size / 3.2)}px)` } as object) : { opacity: 0.35 }) }} />
  );
}

/** Rises and fades in once on mount. */
export function Rise({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 700, delay, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, [v, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [26, 0] }) }] }, style]}>{children}</Animated.View>;
}

export const VEIL = (a: number, b: number): object => Platform.OS === "web" ? ({ backgroundImage: `linear-gradient(180deg, rgba(5,5,6,${a}) 0%, rgba(5,5,6,${b}) 100%)` } as object) : { backgroundColor: `rgba(5,5,6,${(a + b) / 2})` };
export const Fill = { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 } as const;
export { View };
