// Plans side by side. Prices and counts come from the plan records; per-wash is plan price divided by washes.
import { Pressable, View,useWindowDimensions } from "react-native";
import { space } from "@autodeck/ui/theme";
import { glassInner } from "../lib/glass";
import { discountLine, pickupsLine, type CompareCol } from "../lib/membership-view";
import { Chip, Pane, T, rupees } from "./kit";

export function PlanCompare({ cols, onOpen }: { cols: CompareCol[]; onOpen: (planId: string) => void }) {
  // Up to 3 plans sit side by side; 4 make a 2 x 2 grid so prices never wrap.
  const {width}=useWindowDimensions();
  const per=width<480?1:cols.length>3?2:Math.max(1,cols.length);
  const rates=cols.map(c=>c.perWash).filter((v):v is number=>v!==null&&Number.isFinite(v)&&v>0);
  const best=rates.length&&new Set(rates).size>1?Math.min(...rates):null;
  return (
    <Pane pad="none">
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cols.map((c, i) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${rupees(c.price)} per month`} onPress={() => onOpen(c.id)} style={({ pressed }) => ({ width: `${100 / per}%`, padding: 12, gap: space.line, opacity: pressed ? 0.85 : 1, borderLeftWidth: i % per === 0 ? 0 : 1, borderTopWidth: i >= per ? 1 : 0, borderColor: glassInner.backgroundColor })}>
            <T role="bodyStrong">{c.name}</T>
            <T role="heading">{rupees(c.price)}</T><T role="caption" tone="tertiary" numberOfLines={1}>/month</T>
            <T role="heading">{c.washes}</T><T role="caption" tone="secondary">washes / month</T>
            {pickupsLine(c.pickups) ? <T tone="secondary">{pickupsLine(c.pickups)}</T> : null}
            {c.priority ? <T tone="secondary">Priority slot</T> : null}
            {discountLine(c.discount) ? <T tone="secondary">{discountLine(c.discount)}</T> : null}
            {c.perWash !== null ? <T role="caption" tone="tertiary">{rupees(c.perWash)} per wash</T> : null}
            {c.current ? <Chip label="Yours" tone="premium" /> : best!==null&&c.perWash===best ? <Chip label="Best rate" tone="accent" /> : null}
          </Pressable>
        ))}
      </View>
    </Pane>
  );
}
