// First-run story before sign-in: what AutoDeck is, what you can do, the brands.
// Paged, skippable, shown once. Images are bundled, so it opens instantly.
/* eslint-disable @typescript-eslint/no-require-imports */
import { useRef, useState } from "react";
import type { ScrollView } from "react-native";
import { Animated, Image, Platform, Pressable, Text, View, useWindowDimensions, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Logo } from "@autodeck/ui/native";
import { sceneImagery, serviceImagery } from "../lib/imagery";
import { Fill, Orb, Rise, VEIL } from "./Drift";

export const ONBOARDED_KEY = "autodeck.onboarded";

type Slide = { image: ImageSourcePropType; kicker: string; title: string; line: string; chips?: string[] };
const SLIDES: Slide[] = [
  { image: sceneImagery.heroHome, kicker: "AutoDeck", title: "Your car's studio, in your pocket", line: "Premium car care, booked in a minute and tracked from drop-off to delivery." },
  { image: serviceImagery.washing, kicker: "Book", title: "Pick a service. Pick a time.", line: "Washing, ceramic coating, paint protection film and more, with open slots you can see." },
  { image: serviceImagery.ceramic, kicker: "Follow", title: "Watch the work happen", line: "Live status, photos and approvals. Pay at the studio when you collect your car." },
  { image: require("../../assets/imagery/brands/xpel-hero.jpg"), kicker: "Brands we fit", title: "Products you can trust", line: "Only the names the industry relies on, with their own warranties.", chips: ["XPEL", "Garware", "Kovalent"] },
  { image: serviceImagery.ppf, kicker: "Everything in one place", title: "Garage, bills and papers", line: "Keep every car, invoice, warranty and document together, with reminders before anything expires." },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const x = useRef(new Animated.Value(0)).current;
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;
  const finish = () => { void AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => undefined); onDone(); };
  const go = (i: number) => ref.current?.scrollTo({ x: i * width, animated: true });
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  return (
    <View style={{ flex: 1, backgroundColor: "#050506", overflow: "hidden" }}>
      <Animated.ScrollView
        ref={ref as never}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x } } }], { useNativeDriver: false })}
        onMomentumScrollEnd={onEnd}
        style={{ flex: 1 }}
      >
        {SLIDES.map((s, i) => {
          const r = [(i - 1) * width, i * width, (i + 1) * width];
          const shift = x.interpolate({ inputRange: r, outputRange: [width * 0.35, 0, -width * 0.35], extrapolate: "clamp" });
          const textShift = x.interpolate({ inputRange: r, outputRange: [width * 0.6, 0, -width * 0.6], extrapolate: "clamp" });
          const fade = x.interpolate({ inputRange: r, outputRange: [0, 1, 0], extrapolate: "clamp" });
          const zoom = x.interpolate({ inputRange: r, outputRange: [1.25, 1.05, 1.25], extrapolate: "clamp" });
          return (
            <View key={s.kicker + i} style={{ width, height, overflow: "hidden" }}>
              <Animated.View style={{ ...Fill, transform: [{ translateX: shift }, { scale: zoom }] }}>
                <Image source={s.image} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
              </Animated.View>
              <View pointerEvents="none" style={{ ...Fill, ...VEIL(0.35, 0.94) }} />
              <Animated.View style={{ position: "absolute", left: 28, right: 28, bottom: 168, gap: 12, opacity: fade, transform: [{ translateX: textShift }] }}>
                <Text style={{ color: "#F59A45", fontSize: 12, fontWeight: "700", letterSpacing: 2, textTransform: "uppercase" }}>{s.kicker}</Text>
                <Text style={{ color: "#FFFFFF", fontFamily: "Montserrat, Inter, sans-serif", fontSize: 32, lineHeight: 38, fontWeight: "700" }}>{s.title}</Text>
                <Text style={{ color: "#DAD8D5", fontSize: 16, lineHeight: 24 }}>{s.line}</Text>
                {s.chips ? (
                  <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
                    {s.chips.map((c) => (
                      <View key={c} style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(18,18,20,0.5)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", ...(Platform.OS === "web" ? ({ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } as object) : {}) }}>
                        <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 14 }}>{c}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Animated.View>
            </View>
          );
        })}
      </Animated.ScrollView>

      <Orb size={300} color="rgba(245,154,69,0.35)" x="60%" y="-10%" />
      <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, top: 0, paddingTop: 22, paddingHorizontal: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Logo onDark variant="mark" height={30} />
        {!last ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={finish} hitSlop={10} style={{ borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.4)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" }}>
            <Text style={{ color: "#FFFFFF", fontWeight: "600" }}>Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <Rise style={{ position: "absolute", left: 24, right: 24, bottom: 36, gap: 22, alignItems: "center" }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {SLIDES.map((_, i) => {
            const r = [(i - 1) * width, i * width, (i + 1) * width];
            return <Animated.View key={i} style={{ height: 6, borderRadius: 3, backgroundColor: "#F59A45", width: x.interpolate({ inputRange: r, outputRange: [6, 26, 6], extrapolate: "clamp" }), opacity: x.interpolate({ inputRange: r, outputRange: [0.35, 1, 0.35], extrapolate: "clamp" }) }} />;
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => (last ? finish() : go(page + 1))}
          style={({ pressed }) => ({ width: "100%", maxWidth: 420, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: "#F59A45", opacity: pressed ? 0.88 : 1, ...(Platform.OS === "web" ? ({ backgroundImage: "linear-gradient(180deg,#F9B060,#EC8638)", boxShadow: "0 10px 30px rgba(236,134,56,0.4)" } as object) : {}) })}
        >
          <Text style={{ color: "#1A1410", fontWeight: "700", fontSize: 16 }}>{last ? "Get started" : "Next"}</Text>
        </Pressable>
      </Rise>
    </View>
  );
}
