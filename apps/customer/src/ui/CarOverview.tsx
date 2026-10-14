// Car details screen pieces in the Raised theme: round tab pills and the Overview card.
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { raised } from "../lib/raised";

export function TabPills<K extends string>({ tabs, value, onChange }: { tabs: Array<{ key: K; label: string }>; value: K; onChange: (k: K) => void }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable key={t.key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => onChange(t.key)} style={({ pressed }) => ({ paddingHorizontal: 16, height: 40, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.8 : 1, ...(on ? r.roundOn : r.round) })}>
            <Text style={{ color: on ? "#1A1410" : colors.textPrimary, fontSize: 13, fontWeight: "700" }}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export type OverviewProps = {
  health: { ok: boolean; label: string };
  protections: number;
  warranties: number;
  next: { title: string; detail: string; note?: string | undefined; onPress: () => void } | null;
  last: { title: string; detail: string; status: string } | null;
  reminders: string[];
  details: Array<{ label: string; value: string }>;
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

function Status({ icon, label, value, good }: { icon: IconName; label: string; value: string; good: boolean }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <View style={{ flex: 1, padding: 14, gap: 10, ...r.sheet }}>
      <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", ...r.round }}><Icon name={icon} color={good ? "#2E9E6B" : "#EC8638"} size={17} /></View>
      <View style={{ gap: 2 }}>
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "700" }}>{label}</Text>
        <Text numberOfLines={1} style={{ color: colors.textPrimary, fontSize: 15, fontWeight: "800" }}>{value}</Text>
      </View>
    </View>
  );
}

export function CarOverview(p: OverviewProps) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Status icon={p.health.ok ? "check" : "shield"} label="Health" value={p.health.label} good={p.health.ok} />
        <Status icon="shield" label="Protection" value={p.protections > 0 ? `${p.protections} verified` : "None"} good={p.protections > 0} />
        <Status icon="check" label="Warranty" value={p.warranties > 0 ? `${p.warranties} active` : "None"} good={p.warranties > 0} />
      </View>

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

      <Card title="Car details">
        {p.details.map((d, i) => (
          <View key={d.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.borderSubtle }}>
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{d.label}</Text>
            <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{d.value}</Text>
          </View>
        ))}
      </Card>
    </View>
  );
}
