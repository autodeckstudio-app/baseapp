// Compact service-history row: date block, visit title, caption, gold status badge.
// The status badge sits under the visit details, aligned with the name, so a long
// status (READY FOR DELIVERY) never squeezes the name and vehicle into useless
// truncation - on any phone width. Shared by the full Service history screen and
// the car-room preview so both stay the same compact table (no timeline dots/rail).
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Chip, T } from "./kit";

const dayOf = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : new Date(t);
};

export function HistoryVisitRow({ at, title, caption, status, first, onPress, extra, testID }: {
  at: string;
  title: string;
  caption: string;
  status: string;
  first?: boolean;
  onPress?: (() => void) | undefined;
  extra?: ReactNode;
  testID?: string;
}) {
  const d = dayOf(at);
  return (
    <View>
      <Pressable
        testID={testID}
        accessibilityRole={onPress ? "button" : undefined}
        onPress={onPress}
        style={({ pressed }: { pressed: boolean }) => ({ gap: 3, paddingVertical: 9, borderTopWidth: first ? 0 : 1, borderTopColor: "rgba(128,128,128,0.16)", opacity: pressed ? 0.85 : 1 })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 34, alignItems: "center" }}>
            {d ? (
              <>
                <T role="bodyStrong" style={{ fontWeight: "700" }}>{d.getDate()}</T>
                <T role="caption" tone="secondary" style={{ textTransform: "uppercase", fontSize: 10, lineHeight: 13 }}>{d.toLocaleDateString("en-IN", { month: "short" })}</T>
              </>
            ) : (
              <T role="caption" tone="secondary">--</T>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
            <T role="bodyStrong" numberOfLines={2}>{title}</T>
            <T role="caption" tone="secondary" numberOfLines={1}>{caption}</T>
          </View>
        </View>
        <View style={{ paddingLeft: 46 }}>
          <Chip label={status.replace(/_/g, " ").toUpperCase()} tone="premium" small />
        </View>
      </Pressable>
      {extra ? <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>{extra}</View> : null}
    </View>
  );
}
