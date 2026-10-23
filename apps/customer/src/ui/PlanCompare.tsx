// Plans side by side. Prices and counts come from the plan records; per-wash is plan price divided by washes.
import { Pressable, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { glassInner } from "../lib/glass";
import { discountLine, pickupsLine, type CompareCol } from "../lib/membership-view";
import { Chip, Pane, T, rupees } from "./kit";

export function PlanCompare({ cols, onOpen }: { cols: CompareCol[]; onOpen: (planId: string) => void }) {
  // Up to 3 plans sit side by side; 4 make a 2 x 2 grid so prices never wrap.
  const per = cols.length > 3 ? 2 : Math.max(1, cols.length);
  return (
    <Pane pad="none">
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cols.map((c, i) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${rupees(c.price)} per month`} onPress={() => onOpen(c.id)} style={({ pressed }) => ({ width: `${100 / per}%`, padding: 12, gap: space.line, opacity: pressed ? 0.85 : 1, borderLeftWidth: i % per === 0 ? 0 : 1, borderTopWidth: i >= per ? 1 : 0, borderColor: glassInner.backgroundColor })}>
            <T role="bodyStrong">{c.name}</T>
            <T role="heading">{rupees(c.price)}<T role="caption" tone="tertiary">/month</T></T>
            <T tone="secondary">{c.washes} washes</T>
            {pickupsLine(c.pickups) ? <T tone="secondary">{pickupsLine(c.pickups)}</T> : null}
            {c.priority ? <T tone="secondary">Priority slot</T> : null}
            {discountLine(c.discount) ? <T tone="secondary">{discountLine(c.discount)}</T> : null}
            {c.perWash !== null ? <T role="caption" tone="tertiary">{rupees(c.perWash)} per wash</T> : null}
            {c.current ? <Chip label="Yours" tone="premium" /> : c.best ? <Chip label="Best rate" tone="accent" /> : null}
          </Pressable>
        ))}
      </View>
    </Pane>
  );
}
