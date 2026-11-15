"use client";

// Static preview (no data, no auth). Sample records only.
import type { Service } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { ServicesView } from "../../../experience/ServicesView";
import "../../../experience/shell.css";

const S = (id: string, category: string, name: string, rupees: number, mins: number, bay: string, extra: Partial<Service> = {}) => ({ id, category, name, basePrice: rupees * 100, estimatedDurationMinutes: mins, requiredBayType: bay, brand: null, warrantyLabel: null, warrantyDurationUnit: null, warrantyDurationValue: null, membershipWashEligible: false, vehicleCategoryPricing: [], active: true, displayOrder: 0, ...extra }) as unknown as Service;
const ROWS = [
  S("1", "washing", "Wash + wax", 1299, 60, "wash", { membershipWashEligible: true, vehicleCategoryPricing: [{ vehicleCategory: "suv", additionalPricePaise: 30000, additionalMinutes: 15 }] }),
  S("2", "washing", "Interior deep clean", 2999, 90, "wash"),
  S("3", "ceramic", "Ceramic coat", 18450, 240, "protection", { brand: "Gyeon", warrantyLabel: "Coating warranty", warrantyDurationUnit: "years", warrantyDurationValue: 3 }),
  S("4", "ppf", "Full-body PPF", 145000, 2880, "protection", { brand: "XPEL", warrantyLabel: "Film warranty", warrantyDurationUnit: "years", warrantyDurationValue: 10, vehicleCategoryPricing: [{ vehicleCategory: "suv", additionalPricePaise: 2500000, additionalMinutes: 240 }, { vehicleCategory: "luxury", additionalPricePaise: 4000000, additionalMinutes: 480 }] }),
  S("5", "tinting", "Sun film", 6500, 120, "general", { active: false }),
];

export default function Preview() {
  return (
    <StaffShell pathname="/services" office role="admin" who="studio@autodeck.example" home="/design/services" onSignOut={() => {}}>
      <ServicesView services={ROWS} loading={false} error={null} message={null} busy={false} onSave={() => {}} onToggle={() => {}} />
    </StaffShell>
  );
}
