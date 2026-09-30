// Services: the menu, grouped by kind, priced from the smallest car.
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import type { Service } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { serviceImagery } from "../../../lib/imagery";
import { Button, Chip, Kicker, Loading, Notice, PhotoCard, Screen, T, rupees } from "../../../ui/kit";

const GROUP: Record<string, string> = {
  washing: "Wash and care",
  ceramic: "Ceramic",
  coating: "Coatings",
  ppf: "Paint protection film",
  tinting: "Window film",
  inspection: "Inspection",
  other: "More",
};
const ORDER = ["washing", "ceramic", "coating", "ppf", "tinting", "inspection", "other"];

// Step 1 of the journey: what the car needs, in plain words. Each need maps to data categories.
const NEEDS: Array<{ key: string; title: string; line: string; cats: string[]; img: string }> = [
  { key: "wash", title: "Wash and clean", line: "Keep it fresh inside and out", cats: ["washing"], img: "washing" },
  { key: "shine", title: "Shine and protect", line: "Polish and coatings for lasting gloss", cats: ["coating", "other"], img: "coating" },
  { key: "ceramic", title: "Ceramic coating", line: "Hard, glossy protection for years", cats: ["ceramic"], img: "ceramic" },
  { key: "ppf", title: "Paint protection film", line: "Invisible armour against chips and scratches", cats: ["ppf"], img: "ppf" },
  { key: "tint", title: "Window tint", line: "Heat and glare control", cats: ["tinting"], img: "tinting" },
  { key: "check", title: "Not sure? Check my car", line: "We look it over and advise", cats: ["inspection"], img: "inspection" },
];

function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 8 ? `${Math.round(h / 8)} day${h >= 16 ? "s" : ""}` : `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}

export default function CatalogueScreen() {
  const router = useRouter();
  const { need } = useLocalSearchParams<{ need?: string }>();
  const chosen = NEEDS.find((n) => n.key === need) ?? null;
  const [services, setServices] = useState<Service[] | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      setServices(await getServiceCatalogue());
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => void load(), [load]);

  if (!services && !error) return <Loading label="Loading the menu" />;
  const all = services ?? [];
  const from = (n: (typeof NEEDS)[number]) => all.filter((x) => n.cats.includes(x.category));

  if (!chosen) {
    return (
      <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Step 1 of 4</Kicker><T role="title">What does your car need?</T></View>}>
        {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
        {NEEDS.map((n) => {
          const xs = from(n);
          if (!error && xs.length === 0) return null;
          const min = xs.length ? Math.min(...xs.map((x) => x.basePrice)) : null;
          return (
            <PhotoCard key={n.key} image={serviceImagery[n.img as keyof typeof serviceImagery] ?? serviceImagery.other} onPress={() => router.push({ pathname: "/(tabs)/catalogue", params: { need: n.key } })}>
              <View style={{ gap: space.hair }}>
                <T role="heading">{n.title}</T>
                <T role="caption" tone="tertiary">{n.line}</T>
              </View>
              {min !== null ? <T role="bodyStrong" tone="accent">from {rupees(min)}</T> : null}
            </PhotoCard>
          );
        })}
      </Screen>
    );
  }

  const xs = from(chosen);
  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Step 2 of 4 · {chosen.title}</Kicker><T role="title">Pick a package</T></View>}>
      <Button kind="quiet" label="‹ Change what I need" onPress={() => router.replace("/(tabs)/catalogue")} />
      {xs.length === 0 ? <Notice title="Nothing here yet" body="Pick another need, or check back soon." /> : null}
      {xs.map((s) => (
        <PhotoCard key={s.id} image={serviceImagery[s.category] ?? serviceImagery.other} onPress={() => router.push(`/(tabs)/catalogue/${s.id}`)}>
          <View style={{ gap: space.hair }}>
            <T role="heading">{s.name}</T>
            <T role="caption" tone="tertiary">{[s.brand, duration(s.estimatedDurationMinutes)].filter(Boolean).join(" · ")}</T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.line }}>
            {s.warrantyLabel !== null ? <Chip label={s.warrantyLabel} tone="premium" /> : <View />}
            <T role="bodyStrong" tone="accent">from {rupees(s.basePrice)}</T>
          </View>
        </PhotoCard>
      ))}
    </Screen>
  );
}
