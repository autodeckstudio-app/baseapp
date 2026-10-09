import { Redirect } from "expo-router";

// Legacy deep link: /services now lives at /(tabs)/catalogue.
export default function ServicesRedirect() {
  return <Redirect href="/(tabs)/catalogue" />;
}
