// Car details screen pieces in the Raised theme: round tab pills and the Overview card.
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { raised } from "../lib/raised";

export function TabPills<K extends string>({ tabs, value, onChange }: { tabs: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void }) {
  const { colors } = useExperienceTheme();
  // One line always: text tabs with a thin underline, spread across the width.
  return (
    <View style={{ flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(t.key)} style={({ pressed }) => ({ paddingTop: 8, paddingBottom: 8, flexShrink: 1, opacity: pressed ? 0.8 : 1, borderBottomWidth: 2, borderBottomColor: on ? "#EC8638" : "transparent", marginBottom: -1 })}>
            <Text numberOfLines={1} style={{ color: on ? colors.textPrimary : colors.textSecondary, fontSize: 13, fontWeight: on ? "800" : "600" }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type OverviewProps = {
  due: { label: string; date: string; line: string } | null;
  next: { title: string; detail: string; note?: string | undefined; onPress: () => void } | null;
  last: { title: string; detail: string; status: string } | null;
  reminders: string[];
  onBook: () => void;
};

function Card({ title, children, onPress }: { title: string; children: ReactNode; onPress?: (() => void) | undefined }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const body = (
    <View style={{ padding: 16, gap: 10, ...r.sheet }}>
      <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>{title}</Text>
      {children}
    </View>
  );
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress}>{body}</Pressable> : body;
}

export function CarOverview(p: OverviewProps) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <View style={{ gap: 12 }}>
      {p.due ? (
        <Card title="Next due">
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{p.due.label}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{p.due.line} · {p.due.date}</Text>
          </View>
        </Card>
      ) : null}

      {p.reminders.length > 0 ? (
        <Card title="Needs attention">
          {p.reminders.map((t) => (
            <View key={t} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EC8638", marginTop: 6 }} />
              <Text style={{ flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 20 }}>{t}</Text>
            </View>
          ))}
        </Card>
      ) : null}

      <Card title="Next up" onPress={p.next?.onPress ?? p.onBook}>
        {p.next ? (
          <View style={{ gap: 2 }}>
            <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{p.next.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{p.next.detail}</Text>
            {p.next.note ? <Text style={{ color: colors.accentStrong, fontSize: 12, fontWeight: "600", marginTop: 4 }}>{p.next.note}</Text> : null}
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}>No booking yet. Book a wash or check-up.</Text>
            <View style={{ paddingHorizontal: 14, paddingVertical: 8, ...r.quiet }}><Text style={{ color: colors.accentStrong, fontSize: 13, fontWeight: "700" }}>Book</Text></View>
          </View>
        )}
      </Card>

      <Card title="Last service">
        {p.last ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>{p.last.title}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{p.last.detail}</Text>
            </View>
            <View style={{ paddingHorizontal: 10, paddingVertical: 5, ...r.well, borderRadius: 12 }}><Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>{p.last.status}</Text></View>
          </View>
        ) : (
          <Text style={{ color: colors.textTertiary, fontSize: 14 }}>No service history yet</Text>
        )}
      </Card>

    </View>
  );
}
