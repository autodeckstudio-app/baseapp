/**
 * Idempotent first-run seed for a fresh (non-emulator) project:
 *   1. studioConfig/studio-ahmedabad — hours, bays, tax, booking policy.
 *      Shape mirrors the canonical emulator fixture (test/emulator/seed.ts).
 *   2. The three membership plans — tier terms sourced verbatim from
 *      docs/04-current-automodz-pwa-audit.md ("Membership tiers" section —
 *      AutoModz's actual live plan prices/washes/discounts).
 *
 * Safe to re-run: the studio doc is only created when missing (a later
 * admin edit through Studio settings is never clobbered), and each plan is
 * only created when no plan of that tier exists.
 *
 * Usage (targets whatever project the Admin SDK's default credentials point
 * at — set FIRESTORE_EMULATOR_HOST for the emulator, or gcloud ADC for a
 * real project):
 *
 *   npx tsx functions/src/scripts/seed-studio.ts
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { MembershipPlan, MembershipTier, StudioConfig } from "@autodeck/core";
import {
  FIRST_TENANT_ID,
  FIRST_STUDIO_ID,
  DEFAULT_TIMEZONE,
  DEFAULT_CURRENCY,
  DEFAULT_TAX_RATE_PERCENT,
  DEFAULT_TAX_DESCRIPTION,
  SLOT_INTERVAL_MINUTES,
  MAX_ADVANCE_BOOKING_DAYS,
  CANCELLATION_FREE_WINDOW_HOURS,
} from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

const studioConfig: Omit<StudioConfig, "updatedAt"> = {
  id: FIRST_STUDIO_ID,
  tenantId: FIRST_TENANT_ID,
  studioId: FIRST_STUDIO_ID,
  name: "AutoDeck Ahmedabad",
  timezone: DEFAULT_TIMEZONE,
  currency: DEFAULT_CURRENCY,
  taxRatePercent: DEFAULT_TAX_RATE_PERCENT,
  taxDescription: DEFAULT_TAX_DESCRIPTION,
  slotIntervalMinutes: SLOT_INTERVAL_MINUTES,
  maxAdvanceBookingDays: MAX_ADVANCE_BOOKING_DAYS,
  cancellationWindowHours: CANCELLATION_FREE_WINDOW_HOURS,
  vehiclePlateRegex: "^[A-Z]{2}[0-9]{2}[A-Z]{1,2}[0-9]{4}$",
  holidays: [],
  // Mon–Sat open 09:00–19:00, Sunday closed (canonical fixture defaults —
  // adjust through Admin → Studio once real hours are confirmed).
  operatingHours: [
    { dayOfWeek: 0, open: "09:00", close: "19:00", closed: true },
    { dayOfWeek: 1, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 2, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 3, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 4, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 5, open: "09:00", close: "19:00", closed: false },
    { dayOfWeek: 6, open: "09:00", close: "19:00", closed: false },
  ],
  bays: [
    { id: "bay-wash-1", tenantId: FIRST_TENANT_ID, studioId: FIRST_STUDIO_ID, name: "Wash Bay 1", bayType: "wash", active: true },
    { id: "bay-wash-2", tenantId: FIRST_TENANT_ID, studioId: FIRST_STUDIO_ID, name: "Wash Bay 2", bayType: "wash", active: true },
    { id: "bay-protection-1", tenantId: FIRST_TENANT_ID, studioId: FIRST_STUDIO_ID, name: "Protection Bay 1", bayType: "protection", active: true },
    { id: "bay-protection-2", tenantId: FIRST_TENANT_ID, studioId: FIRST_STUDIO_ID, name: "Protection Bay 2", bayType: "protection", active: true },
    { id: "bay-protection-3", tenantId: FIRST_TENANT_ID, studioId: FIRST_STUDIO_ID, name: "Protection Bay 3", bayType: "protection", active: true },
  ],
};

// doc04 "Membership tiers": Silver ₹1,499/4 washes/10%, Gold ₹2,999/8/15%,
// Platinum ₹5,999/16/20%. Prices are monthly (MEMBERSHIP_DURATION_DAYS = 30).
const PLANS: Array<{ id: string; tier: MembershipTier; name: string; priceInPaise: number; includedWashes: number; discountPercent: number }> = [
  { id: "plan-silver", tier: "silver", name: "Silver", priceInPaise: 1499_00, includedWashes: 4, discountPercent: 10 },
  { id: "plan-gold", tier: "gold", name: "Gold", priceInPaise: 2999_00, includedWashes: 8, discountPercent: 15 },
  { id: "plan-platinum", tier: "platinum", name: "Platinum", priceInPaise: 5999_00, includedWashes: 16, discountPercent: 20 },
];

async function seedStudio(): Promise<void> {
  const ref = db.collection(COLLECTIONS.studioConfig()).doc(FIRST_STUDIO_ID);
  const snap = await ref.get();
  if (snap.exists) {
    console.warn(`[seed-studio] studioConfig/${FIRST_STUDIO_ID} already exists - left untouched.`);
  } else {
    const doc: StudioConfig = { ...studioConfig, updatedAt: new Date().toISOString() };
    await ref.set(doc);
    console.warn(`[seed-studio] created studioConfig/${FIRST_STUDIO_ID} (${doc.name}, ${doc.bays.length} bays).`);
  }
}

async function seedPlans(): Promise<void> {
  let created = 0;
  let skipped = 0;
  for (const p of PLANS) {
    const existing = await db
      .collection(COLLECTIONS.membershipPlans())
      .where("tenantId", "==", FIRST_TENANT_ID)
      .where("tier", "==", p.tier)
      .limit(1)
      .get();
    if (!existing.empty) {
      console.warn(`[seed-studio] ${p.tier} plan already exists (${existing.docs[0].id}) - left untouched.`);
      skipped++;
      continue;
    }
    const ref = db.collection(COLLECTIONS.membershipPlans()).doc(p.id);
    const now = new Date().toISOString();
    const plan: MembershipPlan = {
      id: ref.id,
      tenantId: FIRST_TENANT_ID,
      tier: p.tier,
      name: p.name,
      priceInPaise: p.priceInPaise,
      includedWashes: p.includedWashes,
      discountPercent: p.discountPercent,
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(plan);
    console.warn(`[seed-studio] created plan ${plan.id} (${plan.name}, Rs${plan.priceInPaise / 100}/mo, ${plan.includedWashes} washes, ${plan.discountPercent}%).`);
    created++;
  }
  console.warn(`[seed-studio] plans done. ${created} created, ${skipped} already existed.`);
}

if (require.main === module) {
  seedStudio()
    .then(seedPlans)
    .catch((err: unknown) => {
      console.error("[seed-studio] Failed:", err);
      process.exit(1);
    });
}
