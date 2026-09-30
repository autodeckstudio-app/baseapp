// Services: one screen, two levels. Sticky category chips, sub-group sections, search, compact rows.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Service } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { Button, Chip, Kicker, Notice, Pane, Row, Screen, Skeleton, T, rupees } from "../../../ui/kit";

const GROUP: Record<string, string> = {
  washing: "Wash and care",
  ceramic: "Ceramic",
  coating: "Coatings",
  ppf: "Paint film",
  tinting: "Window film",
  inspection: "Inspection",
  other: "More",
};
const ORDER = ["washing", "ceramic", "coating", "ppf", "tinting", "inspection", "other"];
// Old "?need=" deep links map onto a category chip.
const NEED_TO_CAT: Record<string, string> = { wash: "washing", shine: "coating", ceramic: "ceramic", ppf: "ppf", tint: "tinting", check: "inspection" };

/** Second level: derived from the service itself (name, warranty) so new services slot in without a schema change. */
function subGroup(s: Service): string {
  const n = s.name.toLowerCase();
  switch (s.category) {
    case "washing":
      if (/interior|dry clean|spa|upholster|cabin|seat/.test(n)) return "Interior and detail";
      if (/wash|foam|exterior/.test(n)) return "Exterior wash";
      return "Finishing touches";
    case "ppf":
      if (/full|body|complete/.test(n)) return "Full body";
      if (/front|hood|bumper|bonnet|partial|fender/.test(n)) return "Front and partial";
      return "Other coverage";
    case "ceramic":
    case "coating":
      if (s.warrantyLabel) return `${s.warrantyLabel} protection`;
      return s.category === "ceramic" ? "Ceramic packages" : "Polish and coat";
    default:
      return GROUP[s.category] ?? "More";
  }
}

function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 8 ? `${Math.round(h / 8)} day${h >= 16 ? "s" : ""}` : `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}

export default function CatalogueScreen() {
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const { need, cat } = useLocalSearchParams<{ need?: string; cat?: string }>();
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState(false);
  const [active, setActive] = useState<string>("all");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setError(false);
    try {
      setServices(await getServiceCatalogue());
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void load(), [load]);
  useEffect(() => {
    const c = cat ?? (need ? NEED_TO_CAT[need] : undefined);
    if (c) setActive(c);
  }, [need, cat]);

  const all = services ?? [];
  const cats = ORDER.filter((c) => all.some((x) => x.category === c));
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all.filter((x) => (active === "all" || x.category === active) && (!t || `${x.name} ${x.brand ?? ""}`.toLowerCase().includes(t)));
  }, [all, active, q]);
  const sections = useMemo(() => {
    const m = new Map<string, Service[]>();
    for (const s of shown) {
      const k = active === "all" ? `${GROUP[s.category] ?? "More"} · ${subGroup(s)}` : subGroup(s);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [shown, active]);

  const chip = (key: string, label: string) => {
    const on = active === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setActive(key)}
        style={{ borderRadius: 9999, borderWidth: 1, borderColor: on ? colors.accent : colors.borderSubtle, backgroundColor: on ? colors.accentHaze : "transparent", paddingHorizontal: 14, paddingVertical: 8 }}
      >
        <T role="caption" tone={on ? "accent" : "secondary"}>{label}</T>
      </Pressable>
    );
  };

  const top = (
    <View style={{ gap: space.line }}>
      <View style={{ gap: space.hair }}>
        <Kicker tone="accent">Services</Kicker>
        <T role="title">What does your car need?</T>
      </View>
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search washes, ceramic, PPF..."
        placeholderTextColor={colors.textTertiary}
        style={{ borderRadius: 14, borderWidth: 1, borderColor: colors.borderSubtle, paddingHorizontal: 14, paddingVertical: 10, color: colors.textPrimary, fontSize: 15 }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.breath }}>
        {chip("all", "All")}
        {cats.map((c) => chip(c, GROUP[c] ?? c))}
      </ScrollView>
    </View>
  );

  return (
    <Screen top={top}>
      {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {!services && !error ? (
        <View style={{ gap: space.line }}>
          <Skeleton height={18} width="40%" />
          <Skeleton height={64} /><Skeleton height={64} /><Skeleton height={64} />
        </View>
      ) : null}
      {services && sections.length === 0 ? <Notice title="Nothing matches" body="Try another word or pick All." /> : null}
      {sections.map(([title, xs]) => (
        <View key={title} style={{ gap: space.breath }}>
          <Kicker>{title}</Kicker>
          <Pane pad="gap">
            {xs.map((s, i) => (
              <Row
                key={s.id}
                title={s.name}
                detail={<T role="caption" tone="tertiary">{[duration(s.estimatedDurationMinutes), s.brand].filter(Boolean).join(" · ")}</T>}
                trailing={
                  <View style={{ alignItems: "flex-end", gap: 2 }}>
                    <T role="bodyStrong" tone="accent">{rupees(s.basePrice)}</T>
                    {s.warrantyLabel ? <Chip label={s.warrantyLabel} tone="premium" /> : null}
                  </View>
                }
                onPress={() => router.push(`/(tabs)/catalogue/${s.id}`)}
                last={i === xs.length - 1}
              />
            ))}
          </Pane>
        </View>
      ))}
    </Screen>
  );
}
