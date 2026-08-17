/**
 * Idempotent development seed for the Firebase Emulator.
 * Writes a single StudioConfig document for studio-ahmedabad.
 *
 * Usage:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 GCLOUD_PROJECT=autodeck-dev \
 *     npx tsx functions/src/test/emulator/seed.ts
 *
 * Safe to re-run: document is overwritten with the same data each time.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { StudioConfig } from "@autodeck/core";
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

process.env["FIRESTORE_EMULATOR_HOST"] ??= "localhost:8080";
process.env["GCLOUD_PROJECT"] ??= "autodeck-dev";

if (!getApps().length) {
  initializeApp({ projectId: "autodeck-dev" });
}

const db = getFirestore();

const studioConfig: StudioConfig = {
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
  // Mon–Sat open 09:00–19:00, Sunday closed
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
    {
      id: "bay-wash-1",
      tenantId: FIRST_TENANT_ID,
      studioId: FIRST_STUDIO_ID,
      name: "Wash Bay 1",
      bayType: "wash",
      active: true,
    },
    {
      id: "bay-wash-2",
      tenantId: FIRST_TENANT_ID,
      studioId: FIRST_STUDIO_ID,
      name: "Wash Bay 2",
      bayType: "wash",
      active: true,
    },
    {
      id: "bay-protection-1",
      tenantId: FIRST_TENANT_ID,
      studioId: FIRST_STUDIO_ID,
      name: "Protection Bay 1",
      bayType: "protection",
      active: true,
    },
    {
      id: "bay-protection-2",
      tenantId: FIRST_TENANT_ID,
      studioId: FIRST_STUDIO_ID,
      name: "Protection Bay 2",
      bayType: "protection",
      active: true,
    },
    {
      id: "bay-protection-3",
      tenantId: FIRST_TENANT_ID,
      studioId: FIRST_STUDIO_ID,
      name: "Protection Bay 3",
      bayType: "protection",
      active: true,
    },
  ],
  updatedAt: new Date().toISOString(),
};

// Emulator-only bootstrap admin account — lets a developer log into the admin
// web app locally without a manual claims-setting script. NEVER run against
// a real Firebase project (this script only ever targets the Auth/Firestore
// emulators — see FIRESTORE_EMULATOR_HOST/GCLOUD_PROJECT defaults above).
const BOOTSTRAP_ADMIN_EMAIL = "admin@autodeck.dev";
const BOOTSTRAP_ADMIN_PASSWORD = "DevAdmin123!";

async function seedBootstrapAdmin() {
  const auth = getAuth();
  let uid: string;
  try {
    const existing = await auth.getUserByEmail(BOOTSTRAP_ADMIN_EMAIL);
    uid = existing.uid;
  } catch {
    const created = await auth.createUser({
      email: BOOTSTRAP_ADMIN_EMAIL,
      password: BOOTSTRAP_ADMIN_PASSWORD,
      emailVerified: true,
    });
    uid = created.uid;
  }

  await auth.setCustomUserClaims(uid, {
    role: "admin",
    tenantId: FIRST_TENANT_ID,
    studioId: null,
  });

  await db.collection("employees").doc(uid).set({
    id: uid,
    tenantId: FIRST_TENANT_ID,
    studioId: null, // tenant admin — not studio-scoped
    authUid: uid,
    name: "Dev Admin",
    phone: "",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    terminatedAt: null,
  });

  console.warn(`[seed] Bootstrap admin ready: ${BOOTSTRAP_ADMIN_EMAIL} / ${BOOTSTRAP_ADMIN_PASSWORD}`);
}

async function seed() {
  await db.collection("studioConfig").doc(FIRST_STUDIO_ID).set(studioConfig);
  console.warn(`[seed] studioConfig/${FIRST_STUDIO_ID} written`);
  console.warn(`[seed] Bays: 2 wash + 3 protection`);
  await seedBootstrapAdmin();
}

seed().catch((err: unknown) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});
