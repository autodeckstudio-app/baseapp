// Dev-only: the service price block in each state, with fixed fixtures (no network, no real data).
import { View } from "react-native";
import { ServicePrice, type ServicePriceProps } from "../ui/ServicePrice";
import { Screen, T, Kicker } from "../ui/kit";
import type { PriceBreakdown } from "@autodeck/core";

const noop = () => undefined;
const fixture: PriceBreakdown = { vehicleCategory: "suv", basePrice: 1500000, scopeAdjustment: 375000, addOns: [], subtotal: 1875000, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 0, taxDescription: "", tax: 0, total: 1875000, currency: "INR" };
const base: ServicePriceProps = { category: "ppf", priceOnRequest: false, needsCarType: false, hasCar: true, carSizeKnown: true, loading: false, error: null, breakdown: null, onRetry: noop, onGarage: noop };
const cases: { label: string; props: Partial<ServicePriceProps> }[] = [
  { label: "Saved SUV car, price loaded (fixture amounts)", props: { breakdown: fixture } },
  { label: "Car has no saved type", props: { needsCarType: true, carSizeKnown: false } },
  { label: "No car at all", props: { needsCarType: true, hasCar: false, carSizeKnown: false } },
  { label: "Loading", props: { loading: true } },
  { label: "Error: rate limit", props: { error: "functions/resource-exhausted" } },
  { label: "Error: expired sign-in", props: { error: "functions/unauthenticated" } },
  { label: "Error: no answer", props: { error: "functions/internal" } },
];
export default function PreviewPrice() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <T role="title">Price states</T>
      {cases.map((c) => (
        <View key={c.label} style={{ gap: 6 }}><Kicker>{c.label}</Kicker><ServicePrice {...base} {...c.props} /></View>
      ))}
    </Screen>
  );
}
