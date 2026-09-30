// Brand range page: what each brand makes, with warranty only where the brand states it.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Service } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { BRANDS } from "../../../lib/brands";
import { Chip, Kicker, Pane, Row, Screen, T, rupees } from "../../../ui/kit";

export default function BrandScreen() {
  const { b } = useLocalSearchParams<{ b?: string }>();
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const brand = BRANDS.find((x) => x.name.toLowerCase() === (b ?? "").toLowerCase());
  useEffect(() => {
    void getServiceCatalogue().then(setServices).catch(() => undefined);
  }, []);
  if (!brand) return <Screen><T role="title">Brand not found</T></Screen>;
  const mine = services.filter((s) => s.brand?.toLowerCase() === brand.name.toLowerCase());
  const kinds = ["PPF", "Coating", "Other"] as const;
  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Brand</Kicker>
          <T role="title">{brand.name}</T>
          <T role="caption" tone="secondary">{brand.blurb}</T>
        </View>
      }
    >
      {mine.length > 0 ? (
        <View style={{ gap: space.breath }}>
          <Kicker>Book at the studio</Kicker>
          <Pane pad="gap">
            {mine.map((s, i) => (
              <Row
                key={s.id}
                title={s.name}
                detail={s.warrantyLabel ?? undefined}
                trailing={<T role="bodyStrong" tone="accent">{rupees(s.basePrice)}</T>}
                onPress={() => router.push(`/(tabs)/catalogue/${s.id}`)}
                last={i === mine.length - 1}
              />
            ))}
          </Pane>
        </View>
      ) : null}
      {kinds.map((k) => {
        const xs = brand.items.filter((i) => i.kind === k);
        if (xs.length === 0) return null;
        return (
          <View key={k} style={{ gap: space.breath }}>
            <Kicker>{k === "PPF" ? "Paint protection film" : k === "Coating" ? "Coatings" : "More from the range"}</Kicker>
            <Pane pad="gap">
              {xs.map((x, i) => (
                <Row
                  key={x.name}
                  title={x.name}
                  detail={<View style={{ gap: 4 }}>
                    {x.note ? <T role="caption" tone="secondary">{x.note}</T> : null}
                    <T role="caption" tone="tertiary">Price: ask the studio</T>
                  </View>}
                  trailing={x.warranty ? <Chip label={x.warranty.split(" (")[0] ?? x.warranty} tone="premium" /> : undefined}
                  last={i === xs.length - 1}
                />
              ))}
            </Pane>
          </View>
        );
      })}
      <T role="caption" tone="tertiary">Range and warranty as stated by the brand ({brand.source}). Which items the studio fits, and the final terms, are confirmed by the studio. Draft, pending studio review.</T>
    </Screen>
  );
}
