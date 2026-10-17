// Care-plan ring made of thin ticks (no extra graphics library). The lit ticks fill in once on first view.
// Reduce Motion shows the final value at once.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { useReduceMotion } from "../lib/reduce-motion";

const TICKS = 36;

export function CareRing({ fraction, left, total, size = 76 }: { fraction: number; left: number; total: number; size?: number }) {
  const { colors } = useExperienceTheme();
  const reduce = useReduceMotion();
  const target = Math.round(Math.max(0, Math.min(1, fraction)) * TICKS);
  const [lit, setLit] = useState(reduce ? target : 0);
  useEffect(() => {
    if (reduce) { setLit(target); return; }
    setLit(0);
    if (target === 0) return;
    let n = 0;
    const t = setInterval(() => { n += 1; setLit(n); if (n >= target) clearInterval(t); }, Math.max(12, Math.floor(800 / target)));
    return () => clearInterval(t);
  }, [reduce, target]);
  const r = size / 2 - 5;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={`${left} of ${total} washes left`} style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: TICKS }, (_, i) => {
        const a = (i / TICKS) * 2 * Math.PI - Math.PI / 2;
        return <View key={i} style={{ position: "absolute", left: size / 2 + r * Math.cos(a) - 1.25, top: size / 2 + r * Math.sin(a) - 4, width: 2.5, height: 8, borderRadius: 2, backgroundColor: i < lit ? "#EC8638" : "rgba(128,128,128,0.28)", transform: [{ rotate: `${(a + Math.PI / 2)}rad` }] }} />;
      })}
      <View style={{ alignItems: "center" }}>
        <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "800" }}>{left}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 9, fontWeight: "700" }}>{`of ${total}`}</Text>
      </View>
    </View>
  );
}
