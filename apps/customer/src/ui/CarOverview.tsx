// Car details screen pieces in the Raised theme: round tab pills and the Overview card.
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { raised } from "../lib/raised";

export function TabPills<K extends string>({ tabs, value, onChange }: { tabs: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void }) {
  const { colors } = useExperienceTheme();
  const { name } = useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "nowrap", padding: 5, gap: 4, borderRadius: 19, backgroundColor: name === "light" ? "#E3E9F1" : "#202D3D", borderWidth: 1, borderColor: colors.borderSubtle }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return <Pressable key={t.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(t.key)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center", alignItems: "center", borderRadius: 14, paddingHorizontal: 4, opacity: pressed ? 0.8 : 1, backgroundColor: on ? (name === "light" ? "#FFFFFF" : "#3B4B60") : "transparent", ...(on ? { shadowColor: "#172436", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } } : {}) })}>
          <Text numberOfLines={1} style={{ color: on ? colors.textPrimary : colors.textSecondary, fontSize: tabs.length>3?11:13, fontWeight: on ? "800" : "600" }}>{t.label}</Text>
        </Pressable>;
      })}
    </View>
  );
}

export type OverviewProps = {
  due: { label: string; date: string; line: string } | null;
  last: { title: string; detail: string; status: string } | null;
  reminders: string[];
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

      {p.last ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "800", letterSpacing: 1.2, textTransform: "uppercase" }}>Last service</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "700" }}>{p.last.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{p.last.detail}</Text>
          </View>
          <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 }}>{p.last.status}</Text>
        </View>
      ) : null}

    </View>
  );
}
