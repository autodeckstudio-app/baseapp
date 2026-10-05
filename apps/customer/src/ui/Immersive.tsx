// Home's motion pieces: a stage card whose photo drifts slowly behind glass,
// and a depth carousel whose cards tilt and scale as they pass the centre.
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Platform, Pressable, View } from "react-native";
import type { Service } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { ServicePhoto } from "./ServicePhoto";
import { T } from "./kit";
import { priceLabel } from "../lib/catalogue-service";

const reduce = (): boolean => Platform.OS === "web" && !!(globalThis as { matchMedia?: (q: string) => { matches: boolean } }).matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const GRAD = (a: number, b: number): object => ({ backgroundImage: `linear-gradient(180deg, rgba(5,5,6,${a}) 0%, rgba(5,5,6,${b}) 100%)` });

/** Photo behind, slow push-in and drift, dark veil so text always reads. */
export function Stage({ service, children }: { service?: Service | undefined; children: ReactNode }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduce()) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(t, { toValue: 1, duration: 14000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(t, { toValue: 0, duration: 14000, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [t]);
  return (
    <View style={{ borderRadius: 32, overflow: "hidden", backgroundColor: "#111113", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", ...(Platform.OS === "web" ? ({ boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(245,154,69,0.06)" } as object) : {}) }}>
      {service ? (
        <Animated.View pointerEvents="none" key={service.id} style={{ position: "absolute", left: -20, right: -20, top: -20, bottom: -20, transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }, { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) }] }}>
          <ServicePhoto service={service} height={900} radius={0} />
        </Animated.View>
      ) : null}
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(5,5,6,0.55)", ...GRAD(0.35, 0.92) }} />
      <View pointerEvents="none" style={{ position: "absolute", right: -60, top: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: "rgba(245,154,69,0.16)", ...(Platform.OS === "web" ? ({ filter: "blur(40px)" } as object) : {}) }} />
      <View style={{ padding: space.inset }}>{children}</View>
    </View>
  );
}

const CARD = 236;
const STEP = CARD + 14;

/** Cards scale, fade and turn toward the centre as the row is swiped. */
export function DepthCarousel({ items, carName, onOpen }: { items: Service[]; carName?: string | undefined; onOpen: (s: Service) => void }) {
  const x = useRef(new Animated.Value(0)).current;
  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={STEP}
      scrollEventThrottle={16}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: false })}
      contentContainerStyle={{ gap: 14, paddingRight: space.line, paddingVertical: 14 }}
      style={{ marginHorizontal: -space.inset, paddingHorizontal: space.inset, ...(Platform.OS === "web" ? ({ perspective: "900px", scrollSnapType: "x proximity" } as object) : {}) }}
    >
      {items.map((sv, i) => {
        const r = [(i - 1) * STEP, i * STEP, (i + 1) * STEP];
        const scale = x.interpolate({ inputRange: r, outputRange: [0.92, 1, 0.92], extrapolate: "clamp" });
        const opacity = x.interpolate({ inputRange: r, outputRange: [0.65, 1, 0.65], extrapolate: "clamp" });
        const rot = x.interpolate({ inputRange: r, outputRange: ["14deg", "0deg", "-14deg"], extrapolate: "clamp" });
        const lift = x.interpolate({ inputRange: r, outputRange: [10, 0, 10], extrapolate: "clamp" });
        return (
          <Animated.View key={sv.id} style={{ width: CARD, opacity, transform: [{ perspective: 900 }, { translateY: lift }, { rotateY: rot }, { scale }] }}>
            <Pressable accessibilityRole="button" accessibilityLabel={sv.name} onPress={() => onOpen(sv)} style={({ pressed }) => ({ borderRadius: 30, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "#111113", transform: [{ scale: pressed ? 0.97 : 1 }], ...(Platform.OS === "web" ? ({ boxShadow: "0 18px 40px rgba(0,0,0,0.55)" } as object) : {}) })}>
              <ServicePhoto service={sv} height={320} radius={0} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...GRAD(0, 0.9) }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 14, top: 14, borderRadius: 9999, backgroundColor: "rgba(0,0,0,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", paddingHorizontal: 10, paddingVertical: 4 }}>
                <T role="caption" tone="accent">{carName ? `For your ${carName}` : String(i + 1).padStart(2, "0")}</T>
              </View>
              <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, bottom: 16, gap: 8 }}>
                <T role="heading" numberOfLines={2} style={{ color: "#FFFFFF" }}>{sv.name.replace(/^Kovalent\s+/i, "")}</T>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <T role="bodyStrong" style={{ color: "#F4F2EF" }} numberOfLines={1}>{priceLabel(sv)}</T>
                  <View style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 6, backgroundColor: "#F59A45", ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg,#F9B060,#EC8638)" } as object) : {}) }}><T role="caption" style={{ color: "#1A1410" }}>Book</T></View>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}
