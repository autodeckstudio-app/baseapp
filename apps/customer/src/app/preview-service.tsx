// Dev-only: the real service page (ServiceDetailView) with fixed fixtures. No network, no real data. ?state=saved|notype|nocar|error|loading
import { useLocalSearchParams } from "expo-router";
import type { PriceBreakdown, Service, VehicleCategory } from "@autodeck/core";
import { ServiceDetailView } from "./(tabs)/catalogue/[id]";

const service = { id: "fixture-ppf", name: "Garware High-impact kit", category: "ppf", brand: "Garware", description: "Garware paint protection film, high-impact kit coverage.", basePrice: 1500000, estimatedDurationMinutes: 4320, active: true, currency: "INR", vehicleCategoryPricing: [], warrantyLabel: null } as unknown as Service;
const breakdown: PriceBreakdown = { vehicleCategory: "suv", basePrice: 1500000, scopeAdjustment: 375000, addOns: [], subtotal: 1875000, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 0, taxDescription: "", tax: 0, total: 1875000, currency: "INR" };
const noop = () => undefined;

export default function PreviewService() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  if (!__DEV__) return null;
  const car = { id: "fixture-car", make: "Toyota", model: "Land Cruiser" };
  const suv: VehicleCategory = "suv";
  const s = state ?? "saved";
  const hasCar = s !== "nocar";
  const hasType = s === "saved" || s === "error" || s === "loading";
  return (
    <ServiceDetailView
      id="fixture-ppf"
      service={service}
      loading={false}
      loadError={false}
      reviews={null}
      pricingVehicle={{ vehicle: hasCar ? car : null, label: hasType ? "SUV" : null, category: hasType ? suv : null }}
      selectedCategory={hasType ? suv : null}
      needsCarType={!hasType}
      priceLoading={s === "loading"}
      priceError={s === "error" ? "functions/internal" : null}
      priceBreakdown={s === "saved" ? breakdown : null}
      onRetry={noop}
    />
  );
}
