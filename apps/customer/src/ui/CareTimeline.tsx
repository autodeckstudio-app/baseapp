import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Chip, T } from "./kit";
import type { TimelineItem } from "../lib/car-timeline";

/** Width of the rail column. Extras (a button under a row) pull back left by rail + gap so they line up with full-width buttons below the list. */
const RAIL = 12;

/** One thin vertical thread of dated items. Orange dot only for what is due soon. Count label beside the group heading. */
export function CareTimeline({ title, count, items, empty, renderExtra, onItem }: {
  title: string;
  count?: string;
  items: Array<TimelineItem & { jobId?: string }>;
  empty: string;
  renderExtra?: (item: TimelineItem & { jobId?: string }) => ReactNode;
  onItem?: (item: TimelineItem & { jobId?: string }) => void;
}) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ gap: space.breath }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <T role="label" tone="tertiary">{title}</T>
        {count ? <T role="caption" tone="tertiary">{count}</T> : null}
      </View>
      {items.length === 0 ? <T role="caption" tone="secondary">{empty}</T> : items.map((it, n) => {
        const last = n === items.length - 1;
        const body = (
          <View style={{ flexDirection: "row", gap: space.inset }}>
            <View style={{ alignItems: "center", width: RAIL }}>
              <View style={{ width: 8, height: 8, borderRadius: 9999, marginTop: 6, backgroundColor: it.soon ? "#EC8638" : colors.textTertiary }} />
              {last ? null : <View style={{ flex: 1, width: 1, backgroundColor: colors.borderSubtle, marginTop: 4 }} />}
            </View>
            <View style={{ flex: 1, gap: 2, paddingBottom: last ? 0 : space.inset }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: space.breath }}>
                <View style={{ flex: 1, gap: 2 }}>
                  {it.when ? <T role="caption" tone="tertiary">{it.when}</T> : null}
                  <T role="heading">{it.title}</T>
                </View>
                {it.pill ? <Chip label={it.pill} tone={it.soon ? "accent" : "neutral"} /> : null}
              </View>
              {it.sub ? <T role="caption" tone="secondary">{it.sub}</T> : null}
              {renderExtra ? <View style={{ marginTop: space.line, marginLeft: -(RAIL + space.inset) }}>{renderExtra(it)}</View> : null}
            </View>
          </View>
        );
        return onItem ? <Pressable key={it.key} accessibilityRole="button" onPress={() => onItem(it)}>{body}</Pressable> : <View key={it.key}>{body}</View>;
      })}
    </View>
  );
}
