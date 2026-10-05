import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { ONBOARDED_KEY } from "../ui/Onboarding";
import { useAuth } from "../hooks/useAuth";
import { Loading } from "../ui/kit";

// Neutral loading while the persisted session resolves, then one redirect -
// no flash of the login screen for signed-in customers on cold start.
export default function Index() {
  const auth = useAuth();
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => { void AsyncStorage.getItem(ONBOARDED_KEY).then((v) => setSeen(v === "1")).catch(() => setSeen(true)); }, []);
  if (auth.status === "loading") return <Loading label="AutoDeck" />;
  if (auth.status === "ready") return <Redirect href={auth.claims.role === "customer" ? "/(tabs)" : "/(auth)/staff"} />;
  if (auth.status === "authenticated_no_claims") return <Redirect href="/(auth)/setup" />;
  if (seen === null) return <Loading label="AutoDeck" />;
  return <Redirect href={seen ? "/(auth)/login" : "/(auth)/welcome"} />;
}
