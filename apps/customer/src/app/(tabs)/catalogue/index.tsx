// Services: the menu, grouped by kind, priced from the smallest car.
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { Service } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

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

function duration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = min / 60;
  return h >= 8 ? `${Math.round(h / 8)} day${h >= 16 ? "s" : ""}` : `${Number.isInteger(h) ? h : h.toFixed(1)} hr`;
}

export default function CatalogueScreen() {
  const router = useRouter();
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
  const groups = ORDER.map((g) => [g, (services ?? []).filter((s) => s.category === g)] as const).filter(([, xs]) => xs.length > 0);

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Services</Kicker><T role="title">What does your car need?</T></View>}>
      {error ? <Notice title="Can't load services" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}
      {!error && groups.length === 0 ? <Notice title="The menu is being updated" body="Please check back shortly." /> : null}
      {groups.map(([g, xs]) => (
        <View key={g} style={{ gap: space.line }}>
          <Kicker>{GROUP[g] ?? g}</Kicker>
          <Pane pad="gap">
            {xs.map((s, i) => (
              <Row
                key={s.id}
                title={s.name}
                detail={duration(s.estimatedDurationMinutes)}
                trailing={<T role="data" tone="accent">from {rupees(s.basePrice)}</T>}
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
