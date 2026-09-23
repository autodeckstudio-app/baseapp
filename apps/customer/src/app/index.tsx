import { Redirect } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { Loading } from "../ui/kit";

// Neutral loading while the persisted session resolves, then one redirect -
// no flash of the login screen for signed-in customers on cold start.
export default function Index() {
  const auth = useAuth();
  if (auth.status === "loading") return <Loading label="AutoDeck" />;
  if (auth.status === "ready") return <Redirect href={auth.claims.role === "customer" ? "/(tabs)" : "/(auth)/staff"} />;
  if (auth.status === "authenticated_no_claims") return <Redirect href="/(auth)/setup" />;
  return <Redirect href="/(auth)/login" />;
}
