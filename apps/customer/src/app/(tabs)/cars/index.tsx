// Cars: one screen with a Buy | Sell switch. The layout lives in ui/CarsHub.
import { useCallback, useState } from "react";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { CarListingView } from "@autodeck/core";
import { CarsHub } from "../../../ui/CarsHub";
import { useAuth } from "../../../hooks/useAuth";
import { listOwnerKey } from "../../../lib/owner-key";
import { getCarListings } from "../../../lib/carsale-service";

export default function CarsScreen() {
  const router = useRouter();
  const auth=useAuth();
  const scope=JSON.stringify([auth.status,listOwnerKey(auth)?.key,auth.status==='ready'?auth.claims.tenantId:null]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [all, setAll] = useState<CarListingView[] | null>(null);
  const [mine, setMine] = useState<CarListingView[]>([]);
  const [mineError,setMineError]=useState(false);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive=true;setAll(null);setMine([]);setError(false);setMineError(false);
    getCarListings(false).then(v=>{if(alive)setAll(v)}).catch(() => {if(alive)setError(true)});
    getCarListings(true).then(v=>{if(alive)setMine(v)}).catch(() => {if(alive)setMineError(true)});return()=>{alive=false};
  }, [attempt,scope]));
  return <CarsHub all={all} mine={mine} error={error} mineError={mineError} initialTab={params.tab === "sell" ? "sell" : "buy"} onRetry={() => setAttempt((n) => n + 1)} onOpen={(id) => router.push(`/(tabs)/cars/${id}`)} onSell={() => router.push("/(tabs)/cars/sell")} />;
}
