// Cars: one screen with a Buy | Sell switch. The layout lives in ui/CarsHub.
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CarListingView } from "@autodeck/core";
import { CarsHub } from "../../../ui/CarsHub";
import { getCarListings } from "../../../lib/carsale-service";

export default function CarsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [all, setAll] = useState<CarListingView[] | null>(null);
  const [mine, setMine] = useState<CarListingView[]>([]);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setError(false);
    getCarListings(false).then(setAll).catch(() => setError(true));
    getCarListings(true).then(setMine).catch(() => undefined);
  }, [attempt]);
  return <CarsHub all={all} mine={mine} error={error} initialTab={params.tab === "sell" ? "sell" : "buy"} onRetry={() => setAttempt((n) => n + 1)} onOpen={(id) => router.push(`/(tabs)/cars/${id}`)} onSell={() => router.push("/(tabs)/cars/sell")} />;
}
