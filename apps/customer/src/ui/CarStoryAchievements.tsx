import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { useReduceMotion } from "../lib/reduce-motion";
import type { CarStory } from "../lib/car-story";

const MILESTONES = [1, 3, 5, 10] as const;
const LABELS = ["First Spark", "Care Regular", "Garage Insider", "AutoDeck Legend"];

/** Visual recognition only. Delivered records drive every count, never points, money or rewards. */
export function CarStoryAchievements({ story }: { story: CarStory }) {
  const { colors, name } = useExperienceTheme();
  const reduce = useReduceMotion();
  const visits = Math.max(0, Math.floor(story.visits));
  const next = MILESTONES.find(n => visits < n) ?? null;
  const nextTitle = next ? LABELS[MILESTONES.indexOf(next)] : null;
  const earnedTitle = [...MILESTONES].reverse().find(n => visits >= n);
  const currentTitle = earnedTitle ? LABELS[MILESTONES.indexOf(earnedTitle)] : "Your story starts here";
  const fraction = next ? Math.min(1, visits / next) : 1;
  const progress = useRef(new Animated.Value(reduce ? fraction : 0)).current;
  const reveal = useRef(new Animated.Value(reduce ? 1 : 0)).current;
  useEffect(() => {
    progress.stopAnimation(); reveal.stopAnimation();
    if (reduce) { progress.setValue(fraction); reveal.setValue(1); return; }
    progress.setValue(0); reveal.setValue(0);
    Animated.parallel([
      Animated.timing(progress, { toValue: fraction, duration: 650, useNativeDriver: false }),
      Animated.timing(reveal, { toValue: 1, duration: 400, useNativeDriver: false }),
    ]).start();
    return () => { progress.stopAnimation(); reveal.stopAnimation(); };
  }, [fraction, visits, reduce, progress, reveal]);
  const light = name === "light";
  const line = light ? "rgba(50,44,38,0.16)" : "rgba(255,255,255,0.16)";
  return <View testID="car-story-achievements" style={{ gap: 20 }}>
    <Animated.View style={{ opacity: reveal }}>
      <View style={{ flex: 1, minWidth: 150, gap: 4 }}>
        <Text style={{ color: colors.textPrimary, fontSize: 32, fontWeight: "800", letterSpacing: -0.8 }}>{visits}</Text>
        <Text testID="car-story-earned-title" style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{currentTitle}</Text>
        {story.since ? <Text style={{ color: colors.textSecondary, fontSize: 12 }}>First recorded visit · {story.since}</Text> : null}
      </View>
    </Animated.View>
    <View style={{ gap: 10 }}>
      <View accessibilityRole="progressbar" accessibilityLabel={next ? `${visits} of ${next} recorded visits toward the next milestone` : "All displayed visit milestones reached"} accessibilityValue={{ min: 0, max: next ?? 10, now: Math.min(visits, next ?? 10) }} style={{ height: 6, borderRadius: 6, overflow: "hidden", backgroundColor: line }}>
        <Animated.View testID="car-story-progress-fill" style={{ height: "100%", borderRadius: 6, backgroundColor: "#EC8638", width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }} />
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{next ? `${next - visits} more completed ${next - visits === 1 ? "visit" : "visits"} to ${nextTitle}` : "Every completed visit adds to your story"}</Text>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {MILESTONES.map((n, i) => {
        const earned = visits >= n;
        return <View key={n} accessible accessibilityLabel={`${LABELS[i]}: ${earned ? "earned" : "not reached"}, ${n} completed ${n === 1 ? "visit" : "visits"}`} style={{ flexGrow: 1, flexBasis: 120, minWidth: 100, gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: earned ? "rgba(236,134,56,0.45)" : line, backgroundColor: earned ? "rgba(236,134,56,0.10)" : "rgba(128,128,128,0.04)" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 12, fontWeight: "700" }}>{LABELS[i]}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{`${n} ${n === 1 ? "visit" : "visits"} · ${earned ? "Earned" : "To unlock"}`}</Text>
        </View>;
      })}
    </View>
  </View>;
}
