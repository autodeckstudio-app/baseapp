/**
 * Idempotent import of AutoDeck's real service catalogue, sourced verbatim
 * from docs/04-current-automodz-pwa-audit.md ("Service catalogue" section —
 * AutoModz's actual, currently-operating price list). No price, duration, or
 * warranty term in this file was invented; anything not documented there is
 * left null rather than guessed (see the "MISSING DATA" note below).
 *
 * Safe to re-run: each service uses a deterministic ID and is only ever
 * created once (a pre-existing doc is left completely untouched, so a
 * previous admin edit — e.g. deactivating a service — is never clobbered by
 * re-running this script).
 *
 * Usage (targets whatever project the Admin SDK's default credentials point
 * at — set FIRESTORE_EMULATOR_HOST first to run against the emulator, or
 * GOOGLE_APPLICATION_CREDENTIALS / gcloud ADC for a real project):
 *
 *   npx tsx functions/src/scripts/seed-catalogue.ts [tenantId]
 *
 * tenantId defaults to FIRST_TENANT_ID (V1 is single-tenant).
 *
 * MISSING DATA (reported, not guessed):
 * - Ceramic Coating (Kovalent Prolong / Graphene Matrix / Borophene): source
 *   material documents no warranty term for this category — warrantyLabel/
 *   warrantyDurationValue/warrantyDurationUnit are left null. Set them
 *   through Admin → Services once the real warranty terms are known.
 * - No vehicle-category price differential is documented anywhere in the
 *   source material — vehicleCategoryPricing is [] for every service (the
 *   documented price is a single flat price, not a base + adjustment).
 *
 * ARCHITECTURE NOTE: the 6 PPF services have multi-day estimatedDurationMinutes
 * (2880–4320 min), which is genuine, documented AutoModz data (doc04: "A PPF
 * job requiring 2,880 minutes = 4 working days..."). AutoDeck's current
 * getAvailability/generateDaySlots only schedules within a single day's
 * operating-hours window, so these 6 services will show zero bookable slots
 * in the customer app's online booking flow until that engine is extended —
 * they ARE still walk-in-bookable (createWalkinJob's bay-conflict check is
 * duration-agnostic). See Phase 4 HANDOFF for the full explanation.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { Service, ServiceCategory, BayType, WarrantyDurationUnit } from "@autodeck/core";
import { FIRST_TENANT_ID } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

interface CatalogueEntry {
  id: string;
  name: string;
  category: ServiceCategory;
  brand: string | null;
  description: string;
  basePrice: number; // paise
  estimatedDurationMinutes: number;
  warrantyLabel: string | null;
  warrantyDurationValue: number | null;
  warrantyDurationUnit: WarrantyDurationUnit | null;
  requiredBayType: BayType;
  membershipWashEligible: boolean;
  displayOrder: number;
}

export const CATALOGUE: CatalogueEntry[] = [
  // ─── PPF (protection bays) — doc04 lines 395–403 ───────────────────────────
  {
    id: "svc-ppf-llumar-gloss",
    name: "LLumar Gloss",
    category: "ppf",
    brand: "LLumar",
    description: "LLumar Gloss paint protection film — full-body coverage with a glossy finish.",
    basePrice: 145_000_00, // ₹1,45,000
    estimatedDurationMinutes: 2880,
    warrantyLabel: "5-Year PPF Film Warranty",
    warrantyDurationValue: 5,
    warrantyDurationUnit: "years",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 0,
  },
  {
    id: "svc-ppf-llumar-platinum",
    name: "LLumar Platinum",
    category: "ppf",
    brand: "LLumar",
    description: "LLumar Platinum paint protection film — enhanced durability and clarity.",
    basePrice: 205_000_00, // ₹2,05,000
    estimatedDurationMinutes: 3600,
    warrantyLabel: "10-Year PPF Film Warranty",
    warrantyDurationValue: 10,
    warrantyDurationUnit: "years",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 1,
  },
  {
    id: "svc-ppf-llumar-valor",
    name: "LLumar Valor",
    category: "ppf",
    brand: "LLumar",
    description: "LLumar Valor paint protection film — top-tier self-healing protection.",
    basePrice: 220_000_00, // ₹2,20,000
    estimatedDurationMinutes: 4320,
    warrantyLabel: "12-Year PPF Film Warranty",
    warrantyDurationValue: 12,
    warrantyDurationUnit: "years",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 2,
  },
  {
    id: "svc-ppf-garware-plus",
    name: "Garware Plus",
    category: "ppf",
    brand: "Garware",
    description: "Garware Plus paint protection film for everyday protection.",
    basePrice: 85_000_00, // ₹85,000
    estimatedDurationMinutes: 2880,
    warrantyLabel: "5-Year PPF Film Warranty",
    warrantyDurationValue: 5,
    warrantyDurationUnit: "years",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 3,
  },
  {
    id: "svc-ppf-garware-premium",
    name: "Garware Premium",
    category: "ppf",
    brand: "Garware",
    description: "Garware Premium paint protection film with extended coverage.",
    basePrice: 105_000_00, // ₹1,05,000
    estimatedDurationMinutes: 2880,
    warrantyLabel: "8-Year PPF Film Warranty",
    warrantyDurationValue: 8,
    warrantyDurationUnit: "years",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 4,
  },
  {
    id: "svc-ppf-garware-platinum",
    name: "Garware Platinum",
    category: "ppf",
    brand: "Garware",
    description: "Garware Platinum paint protection film — the studio's longest-lasting PPF option.",
    basePrice: 145_000_00, // ₹1,45,000
    estimatedDurationMinutes: 3600,
    warrantyLabel: "Lifetime PPF Film Warranty",
    warrantyDurationValue: null,
    warrantyDurationUnit: "lifetime",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 5,
  },

  // ─── Ceramic Coating (protection bays) — doc04 lines 405–410 ───────────────
  // No warranty term documented in source material — left null (see MISSING DATA above).
  {
    id: "svc-ceramic-kovalent-prolong",
    name: "Kovalent Prolong",
    category: "ceramic",
    brand: "Kovalent",
    description: "Kovalent Prolong ceramic coating for long-lasting gloss and protection.",
    basePrice: 10_000_00, // ₹10,000
    estimatedDurationMinutes: 480,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 6,
  },
  {
    id: "svc-ceramic-graphene-matrix",
    name: "Graphene Matrix",
    category: "ceramic",
    brand: null,
    description: "Graphene-infused ceramic coating for enhanced hydrophobicity and durability.",
    basePrice: 12_000_00, // ₹12,000
    estimatedDurationMinutes: 720,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 7,
  },
  {
    id: "svc-ceramic-borophene",
    name: "Borophene",
    category: "ceramic",
    brand: null,
    description: "Borophene ceramic coating — the studio's premium coating tier.",
    basePrice: 14_000_00, // ₹14,000
    estimatedDurationMinutes: 840,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 8,
  },

  // ─── Washing (wash bays) — doc04 lines 412–420 — membership wash-eligible ──
  {
    id: "svc-wash-regular",
    name: "Regular Wash",
    category: "washing",
    brand: null,
    description: "Standard exterior wash and dry.",
    basePrice: 500_00,
    estimatedDurationMinutes: 45,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "wash",
    membershipWashEligible: true,
    displayOrder: 9,
  },
  {
    id: "svc-wash-premium",
    name: "Premium Wash",
    category: "washing",
    brand: null,
    description: "Extended wash with additional exterior care.",
    basePrice: 1_000_00,
    estimatedDurationMinutes: 60,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "wash",
    membershipWashEligible: true,
    displayOrder: 10,
  },
  {
    id: "svc-wash-detail-spa",
    name: "Detail SPA",
    category: "washing",
    brand: null,
    description: "Thorough wash and detailing spa treatment.",
    basePrice: 2_500_00,
    estimatedDurationMinutes: 90,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "wash",
    membershipWashEligible: true,
    displayOrder: 11,
  },
  {
    id: "svc-wash-dry-clean",
    name: "Dry Clean",
    category: "washing",
    brand: null,
    description: "Waterless dry cleaning wash.",
    basePrice: 4_000_00,
    estimatedDurationMinutes: 120,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "wash",
    membershipWashEligible: true,
    displayOrder: 12,
  },
  {
    id: "svc-wash-roof-cleaning",
    name: "Roof Cleaning",
    category: "washing",
    brand: null,
    description: "Dedicated roof cleaning service.",
    basePrice: 800_00,
    estimatedDurationMinutes: 30,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "wash",
    membershipWashEligible: true,
    displayOrder: 13,
  },
  {
    id: "svc-wash-headlight-buffing",
    name: "Headlight Buffing",
    category: "washing",
    brand: null,
    description: "Headlight restoration and buffing.",
    basePrice: 400_00,
    estimatedDurationMinutes: 20,
    warrantyLabel: null,
    warrantyDurationValue: null,
    warrantyDurationUnit: null,
    requiredBayType: "wash",
    membershipWashEligible: true,
    displayOrder: 14,
  },

  // ─── Other Coatings (protection bays) — doc04 lines 422–427 ────────────────
  {
    id: "svc-coating-teflon",
    name: "Teflon",
    category: "coating",
    brand: null,
    description: "Teflon paint sealant for added shine and protection.",
    basePrice: 5_000_00,
    estimatedDurationMinutes: 120,
    warrantyLabel: "6-Month Teflon Warranty",
    warrantyDurationValue: 6,
    warrantyDurationUnit: "months",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 15,
  },
  {
    id: "svc-coating-glass",
    name: "Glass Coating",
    category: "coating",
    brand: null,
    description: "Hydrophobic glass coating for windshield and windows.",
    basePrice: 1_200_00,
    estimatedDurationMinutes: 60,
    warrantyLabel: "3-Month Glass Coating Warranty",
    warrantyDurationValue: 3,
    warrantyDurationUnit: "months",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 16,
  },
  {
    id: "svc-coating-maintenance",
    name: "Maintenance Coat",
    category: "coating",
    brand: null,
    description: "Maintenance coating top-up for existing protection.",
    basePrice: 4_500_00,
    estimatedDurationMinutes: 90,
    warrantyLabel: "1-Year Maintenance Coat Warranty",
    warrantyDurationValue: 1,
    warrantyDurationUnit: "years",
    requiredBayType: "protection",
    membershipWashEligible: false,
    displayOrder: 17,
  },
];

export async function seedCatalogue(tenantId: string) {
  let created = 0;
  let skipped = 0;

  for (const entry of CATALOGUE) {
    const ref = db.collection(COLLECTIONS.services()).doc(entry.id);
    const existing = await ref.get();
    if (existing.exists) {
      skipped++;
      console.warn(`[seed-catalogue] skip (already exists): ${entry.id}`);
      continue;
    }

    const now = new Date().toISOString();
    const service: Service = {
      id: entry.id,
      tenantId,
      name: entry.name,
      category: entry.category,
      brand: entry.brand,
      description: entry.description,
      basePrice: entry.basePrice,
      currency: "INR",
      estimatedDurationMinutes: entry.estimatedDurationMinutes,
      warrantyLabel: entry.warrantyLabel,
      warrantyDurationValue: entry.warrantyDurationValue,
      warrantyDurationUnit: entry.warrantyDurationUnit,
      vehicleCategoryPricing: [],
      requiredBayType: entry.requiredBayType,
      membershipWashEligible: entry.membershipWashEligible,
      active: true,
      displayOrder: entry.displayOrder,
      createdAt: now,
      updatedAt: now,
    };

    await ref.set(service);
    created++;
    console.warn(`[seed-catalogue] created: ${entry.id} (${entry.name})`);
  }

  console.warn(`[seed-catalogue] Done. ${created} created, ${skipped} already existed, ${CATALOGUE.length} total.`);
}

// Only auto-run when executed directly (`tsx seed-catalogue.ts`), not when
// imported (e.g. by the emulator test that exercises CATALOGUE/seedCatalogue
// directly without wanting the side effect of a real run). This project
// compiles to CommonJS, so the CJS "am I main" check is used, not import.meta.
if (require.main === module) {
  const tenantIdArg = process.argv[2] ?? FIRST_TENANT_ID;
  seedCatalogue(tenantIdArg).catch((err: unknown) => {
    console.error("[seed-catalogue] Failed:", err);
    process.exit(1);
  });
}
