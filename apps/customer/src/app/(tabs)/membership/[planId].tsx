// Plan detail and purchase are one screen: old links land on it.
import { Redirect, useLocalSearchParams } from "expo-router";

export default function PlanRedirect() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  return <Redirect href={{ pathname: "/(tabs)/membership/purchase", params: { planId } }} />;
}
