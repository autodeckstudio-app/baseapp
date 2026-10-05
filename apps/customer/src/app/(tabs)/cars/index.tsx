// Cars for sale: studio stock and approved customer cars as a grid of photo cards, plus "Sell your car" and your own listings.
import { useEffect, useMemo, useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { CarListingView } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Field, Kicker, Notice, Screen, Skeleton, T } from "../../../ui/kit";
import { getCarListings, inr, kmLabel } from "../../../lib/carsale-service";

const STATE: Record<string, string> = { pending: "Waiting for review", live: "Live", reserved: "Reserved", sold: "Sold", rejected: "Not approved", expired: "Expired", draft: "Draft" };

const BUDGETS: Array<{ id: string; label: string; max: number }> = [
  { id: "any", label: "Any budget", max: Infinity },
  { id: "5", label: "Under 5 lakh", max: 500000 * 100 },
  { id: "10", label: "Under 10 lakh", max: 1000000 * 100 },
  { id: "20", label: "Under 20 lakh", max: 2000000 * 100 },
];
const FUEL_FILTERS = ["petrol", "diesel", "cng", "electric", "hybrid"];

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? "#EC8638" : "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: on ? "#EC8638" : "#E6DFF0" }}
    >
      <T role="label" style={{ color: on ? "#FFFFFF" : "#4A4458", textTransform: "capitalize" }}>{label}</T>
    </Pressable>
  );
}

function Card({ l, onPress }: { l: CarListingView; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => ({ width: "48%", flexGrow: 1, opacity: pressed ? 0.85 : 1 })}>
      <View style={{ borderRadius: 22, overflow: "hidden", aspectRatio: 4 / 5, backgroundColor: "#EEE9F6" }}>
        <Image source={{ uri: l.photoUrls[0] }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
        {l.status === "reserved" ? (
          <View style={{ position: "absolute", left: 8, top: 8, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 10, paddingVertical: 4 }}>
            <T role="caption" tone="accent">Reserved</T>
          </View>
        ) : null}
      </View>
      <View style={{ paddingTop: 8, gap: 2 }}>
        <T role="bodyStrong" numberOfLines={1}>{l.year} {l.make} {l.model}</T>
        <T role="caption" tone="tertiary" numberOfLines={1} style={{ textTransform: "capitalize" }}>{kmLabel(l.kmDriven)} · {l.fuel} · {l.gearbox}</T>
        <T role="bodyStrong" tone="accent" numberOfLines={1}>{inr(l.askingPrice)}</T>
      </View>
    </Pressable>
  );
}

export default function CarsScreen() {
  const router = useRouter();
  const [all, setAll] = useState<CarListingView[] | null>(null);
  const [mine, setMine] = useState<CarListingView[]>([]);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [fuel, setFuel] = useState<string | null>(null);
  const [budget, setBudget] = useState("any");
  const [sort, setSort] = useState<"new" | "low" | "high">("new");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const max = BUDGETS.find((b) => b.id === budget)?.max ?? Infinity;
    const list = (all ?? []).filter((l) =>
      (!q || `${l.make} ${l.model} ${l.variant ?? ""} ${l.year} ${l.area}`.toLowerCase().includes(q)) &&
      (!fuel || l.fuel === fuel) && l.askingPrice <= max);
    if (sort === "low") return [...list].sort((a, b) => a.askingPrice - b.askingPrice);
    if (sort === "high") return [...list].sort((a, b) => b.askingPrice - a.askingPrice);
    return list;
  }, [all, query, fuel, budget, sort]);
  const filtering = query.trim() !== "" || fuel !== null || budget !== "any";
  useEffect(() => {
    getCarListings(false).then(setAll).catch(() => setError(true));
    getCarListings(true).then(setMine).catch(() => undefined);
  }, []);

  return (
    <Screen
      top={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Cars for sale</Kicker>
          <T role="title">Find your next car</T>
        </View>
      }
    >
      <Button label="Sell your car" onPress={() => router.push("/(tabs)/cars/sell")} />
      {all && all.length > 0 ? (
        <View style={{ gap: space.line }}>
          <Field label="Search" value={query} onChangeText={setQuery} placeholder="Make, model, year or area" autoCapitalize="none" maxLength={60} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {BUDGETS.map((b) => <Pill key={b.id} label={b.label} on={budget === b.id} onPress={() => setBudget(b.id)} />)}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {FUEL_FILTERS.map((f) => <Pill key={f} label={f} on={fuel === f} onPress={() => setFuel(fuel === f ? null : f)} />)}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pill label="Newest" on={sort === "new"} onPress={() => setSort("new")} />
            <Pill label="Price low to high" on={sort === "low"} onPress={() => setSort("low")} />
            <Pill label="Price high to low" on={sort === "high"} onPress={() => setSort("high")} />
          </View>
        </View>
      ) : null}
      {error ? <Notice title="Can't load cars" body="Check your connection and try again." /> : null}
      {!all && !error ? <View style={{ gap: space.line }}><Skeleton height={200} /><Skeleton height={200} /></View> : null}
      {all && all.length === 0 ? <Notice title="No cars listed yet" body="New cars appear here as soon as the studio lists them." /> : null}
      {all && all.length > 0 && shown.length === 0 && filtering ? (
        <Notice title="No cars match" body="Try a wider budget or clear the search." action={<Button kind="quiet" label="Clear filters" onPress={() => { setQuery(""); setFuel(null); setBudget("any"); }} />} />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
        {shown.map((l) => <Card key={l.id} l={l} onPress={() => router.push(`/(tabs)/cars/${l.id}`)} />)}
      </View>

      {mine.length > 0 ? (
        <View style={{ gap: space.breath }}>
          <Kicker>Your cars for sale</Kicker>
          {mine.map((l) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/cars/${l.id}`)} style={{ flexDirection: "row", gap: space.line, alignItems: "center" }}>
              <Image source={{ uri: l.photoUrls[0] }} resizeMode="cover" style={{ width: 72, height: 72, borderRadius: 14 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T role="bodyStrong" numberOfLines={1}>{l.year} {l.make} {l.model}</T>
                <T role="caption" tone="tertiary">{inr(l.askingPrice)}</T>
                {l.status === "rejected" && l.rejectionReason ? <T role="caption" tone="secondary" numberOfLines={2}>{l.rejectionReason}</T> : null}
              </View>
              <Chip label={STATE[l.status] ?? l.status} tone={l.status === "live" ? "accent" : l.status === "rejected" ? "danger" : "neutral"} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <T role="caption" tone="tertiary">AutoDeck lists cars to help buyers and sellers meet. We are not a party to the sale, and ownership papers and transfer are between buyer and seller.</T>
    </Screen>
  );
}
