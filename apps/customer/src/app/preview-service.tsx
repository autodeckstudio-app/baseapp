// Dev-only: the real service page (ServiceDetailView) with fixed fixtures. No network, no real data. ?state=saved|notype|nocar|error|loading
// ?id=<catalogue id> renders that service from the dev catalogue sample (canonical copy) with a plain base-price breakdown.
import { useLocalSearchParams } from "expo-router";
import type { PriceBreakdown, Service, VehicleCategory } from "@autodeck/core";
import { ServiceDetailView } from "./(tabs)/catalogue/[id]";
import { devCatalogue } from "../lib/dev-catalogue-loader";

const service = { id: "fixture-ppf", name: "Garware High-impact kit", category: "ppf", brand: "Garware", description: "Garware paint protection film, high-impact kit coverage.", basePrice: 1500000, estimatedDurationMinutes: 4320, active: true, currency: "INR", vehicleCategoryPricing: [], warrantyLabel: null } as unknown as Service;
const breakdown: PriceBreakdown = { vehicleCategory: "suv", basePrice: 1500000, scopeAdjustment: 375000, addOns: [], subtotal: 1875000, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 0, taxDescription: "", tax: 0, total: 1875000, currency: "INR" };
const noop = () => undefined;

export default function PreviewService() {
  const { state, id } = useLocalSearchParams<{ state?: string; id?: string }>();
  if (!__DEV__) return null;
  const car = { id: "fixture-car", make: "Toyota", model: "Land Cruiser" };
  const suv: VehicleCategory = "suv";
  const s = state ?? "saved";
  const hasCar = s !== "nocar";
  const hasType = s === "saved" || s === "error" || s === "loading";
  const row = id ? (devCatalogue ?? []).find((r) => r.id === id) : undefined;
  const sampleService = row
    ? ({ id: row.id, name: row.name, category: row.category, brand: row.brand, description: row.description, basePrice: row.rupees * 100, estimatedDurationMinutes: row.minutes, active: true, currency: "INR", vehicleCategoryPricing: [], warrantyLabel: null, priceOnRequest: row.consult === true, coverageLevel: row.coverageLevel ?? null } as unknown as Service)
    : null;
  const sampleBreakdown: PriceBreakdown | null = row
    ? { vehicleCategory: "suv", basePrice: row.rupees * 100, scopeAdjustment: 0, addOns: [], subtotal: row.rupees * 100, membershipDiscount: null, membershipDiscountPercent: null, pickupFee: 0, dropFee: 0, taxRatePercent: 0, taxDescription: "", tax: 0, total: row.rupees * 100, currency: "INR" }
    : null;
  return (
    <ServiceDetailView
      id={row ? row.id : "fixture-ppf"}
      service={sampleService ?? service}
      loading={false}
      loadError={false}
      reviews={null}
      pricingVehicle={{ vehicle: hasCar ? car : null, label: hasType ? "SUV" : null, category: hasType ? suv : null }}
      selectedCategory={hasType ? suv : null}
      needsCarType={!hasType}
      priceLoading={s === "loading"}
      priceError={s === "error" ? "functions/internal" : null}
      priceBreakdown={s === "saved" ? (sampleBreakdown ?? breakdown) : null}
      onRetry={noop}
    />
  );
}
