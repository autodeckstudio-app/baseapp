import { Redirect } from "expo-router";

// Legacy deep link: /sell now lives at /(tabs)/cars/sell.
export default function SellRedirect() {
  return <Redirect href="/(tabs)/cars/sell" />;
}
