// Plans side by side. Prices and counts come from the plan records; per-wash is plan price divided by washes.
import { Pressable, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { glassInner } from "../lib/glass";
import { discountLine, type CompareCol } from "../lib/membership-view";
import { Chip, Pane, T, rupees } from "./kit";

export function PlanCompare({ cols, onOpen }: { cols: CompareCol[]; onOpen: (planId: string) => void }) {
  return (
    <Pane pad="none">
      <View style={{ flexDirection: "row" }}>
        {cols.map((c, i) => (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${c.name}, ${rupees(c.price)}`} onPress={() => onOpen(c.id)} style={({ pressed }) => ({ flex: 1, padding: 12, gap: space.line, opacity: pressed ? 0.85 : 1, borderLeftWidth: i === 0 ? 0 : 1, borderLeftColor: glassInner.backgroundColor })}>
            <T role="bodyStrong">{c.name}</T>
            <T role="heading">{rupees(c.price)}</T>
            <T tone="secondary">{c.washes} washes</T>
            {discountLine(c.discount) ? <T tone="secondary">{discountLine(c.discount)}</T> : null}
            {c.perWash !== null ? <T role="caption" tone="tertiary">{rupees(c.perWash)} per wash</T> : null}
            {c.current ? <Chip label="Yours" tone="premium" /> : c.best ? <Chip label="Best rate" tone="accent" /> : null}
          </Pressable>
        ))}
      </View>
    </Pane>
  );
}
