/**
 * End-to-end V1 journey driver for a deployed (non-emulator) environment.
 * Drives the real callable chain over HTTPS as two identities:
 *   customer (journey-test@example.com, auto-created) and owner (admin).
 *
 * Steps: setupCustomerProfile > resolveClaims > createVehicle >
 * getAvailability > createBooking > advanceJobStatus x5 (studio) >
 * recordManualPayment (cash) > confirmManualPayment > readback of
 * job/booking/invoice state.
 *
 * Idempotent-ish: reuses the existing test user and vehicle, and a fixed
 * booking idempotency key (a re-run returns the existing booking). Invalid
 * status transitions on re-run are logged and skipped.
 *
 * Usage:
 *   FIREBASE_API_KEY=<web api key> npx tsx functions/src/scripts/drive-journey.ts
 *
 * The web API key is a public client identifier (it ships in every client
 * bundle); it is only used to exchange Admin-SDK custom tokens for ID tokens.
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "crypto";

const PROJECT = "autodeck-studio";
const REGION = "asia-south1";
const STUDIO_ID = "studio-ahmedabad";
const CUSTOMER_EMAIL = "journey-test@example.com";
const OWNER_EMAIL = "autodeckstudio@gmail.com";
const PLATE = "GJ01JT0001";
const WASH_SERVICE = "svc-wash-regular";
const IDEMPOTENCY_KEY = "journey-drive-001";

const API_KEY = process.env["FIREBASE_API_KEY"];
if (!API_KEY) {
  console.error("FIREBASE_API_KEY env var required");
  process.exit(1);
}

// createCustomToken needs a service-account signer: with end-user ADC (e.g.
// Cloud Shell) the SDK would otherwise try to sign as the gcloud user and fail
// with "Gaia id not found". Pass the project's App Engine default SA; the
// caller's identity needs iam.serviceAccountTokenCreator on it (Owner does).
const SA_EMAIL = process.env["SA_EMAIL"];
if (!getApps().length) {
  initializeApp(SA_EMAIL ? { serviceAccountId: SA_EMAIL } : {});
}
const auth = getAuth();
const db = getFirestore();

function log(step: string, info: unknown): void {
  console.warn(`[journey] ${step}: ${typeof info === "string" ? info : JSON.stringify(info).slice(0, 240)}`);
}

async function idTokenFor(email: string): Promise<{ uid: string; token: string }> {
  let uid: string;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    uid = (await auth.createUser({ email, emailVerified: true })).uid;
  }
  const custom = await auth.createCustomToken(uid);
  const r = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const j = (await r.json()) as { idToken?: string; error?: unknown };
  if (!j.idToken) throw new Error(`token exchange failed for ${email}: ${JSON.stringify(j).slice(0, 200)}`);
  return { uid, token: j.idToken };
}

async function callFn(name: string, token: string, data: Record<string, unknown>): Promise<any> {
  const r = await fetch(`https://${REGION}-${PROJECT}.cloudfunctions.net/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data }),
  });
  const j = (await r.json().catch(() => ({}))) as { result?: unknown; error?: unknown };
  if (!r.ok || j.error) {
    throw new Error(`${name} failed (${r.status}): ${JSON.stringify(j).slice(0, 300)}`);
  }
  return j.result ?? j;
}

function tomorrowIST(): string {
  const now = new Date(Date.now() + 24 * 3600 * 1000);
  const ist = new Date(now.getTime() + 5.5 * 3600 * 1000);
  return ist.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  // ── Customer identity ──────────────────────────────────────────────────────
  const cust = await idTokenFor(CUSTOMER_EMAIL);
  log("customer uid", cust.uid);

  await callFn("setupCustomerProfile", cust.token, { name: "Journey Test" });
  log("setupCustomerProfile", "ok");
  await callFn("resolveClaims", cust.token, {});
  log("resolveClaims", "ok - re-minting token to pick up claims");
  const cust2 = await idTokenFor(CUSTOMER_EMAIL);

  // ── Vehicle (reuse if the plate is already registered) ────────────────────
  let vehicleId: string | null = null;
  const existingV = await db.collection("vehicles").where("registrationNumber", "==", PLATE).limit(1).get();
  if (!existingV.empty) {
    vehicleId = existingV.docs[0].id;
    log("createVehicle", `reusing existing ${vehicleId}`);
  } else {
    const v = await callFn("createVehicle", cust2.token, {
      registrationNumber: PLATE,
      make: "Journey",
      model: "Test SUV",
      year: 2023,
      color: "Black",
      category: "suv",
    });
    vehicleId = (v.vehicle?.id ?? v.vehicleId ?? v.id) as string;
    log("createVehicle", vehicleId);
  }
  if (!vehicleId) throw new Error("no vehicleId");

  // ── Availability + booking ─────────────────────────────────────────────────
  const date = tomorrowIST();
  const avail = await callFn("getAvailability", cust2.token, {
    serviceId: WASH_SERVICE,
    studioId: STUDIO_ID,
    startDate: date,
    lookAheadDays: 3,
  });
  const slots = (avail.slots ?? []) as Array<{ date: string; startTime: string }>;
  log("getAvailability", `${slots.length} slots from ${date}`);
  if (!slots.length) throw new Error("no availability - studio config or bay issue");
  const slot = slots[0];
  log("chosen slot", `${slot.date} ${slot.startTime}`);

  const b = await callFn("createBooking", cust2.token, {
    serviceId: WASH_SERVICE,
    vehicleId,
    vehicleCategory: "suv",
    studioId: STUDIO_ID,
    scheduledDate: slot.date,
    scheduledTime: slot.startTime,
    idempotencyKey: IDEMPOTENCY_KEY,
  });
  const booking = b.booking ?? b;
  log("createBooking", { id: booking.id, status: booking.status, total: booking.totalAmount });

  // ── Studio identity ────────────────────────────────────────────────────────
  const owner = await idTokenFor(OWNER_EMAIL);
  log("owner uid", owner.uid);

  // ── Find the job created with the booking ──────────────────────────────────
  const jobSnap = await db.collection("jobs").where("bookingId", "==", booking.id).limit(1).get();
  if (jobSnap.empty) throw new Error("no job found for booking " + booking.id);
  const jobId = jobSnap.docs[0].id;
  log("job", { jobId, status: jobSnap.docs[0].data().status });

  // ── Advance the job through the full chain ─────────────────────────────────
  for (const next of ["VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"]) {
    try {
      const r = await callFn("advanceJobStatus", owner.token, { jobId, notes: `journey drive -> ${next}` });
      log("advanceJobStatus", (r.job?.status ?? r.status ?? next) as string);
    } catch (e) {
      log("advanceJobStatus", `skip (${next}): ${(e as Error).message.slice(0, 140)}`);
    }
  }

  // ── Payment (manual cash path - no Razorpay needed) ────────────────────────
  try {
    const p = await callFn("recordManualPayment", owner.token, { jobId, method: "cash", manualReference: "journey-drive" });
    const paymentId = (p.payment?.id ?? p.paymentId ?? p.id) as string;
    log("recordManualPayment", paymentId);
    const c = await callFn("confirmManualPayment", owner.token, { paymentId });
    log("confirmManualPayment", (c.payment?.status ?? "ok") as string);
  } catch (e) {
    log("payment", `issue: ${(e as Error).message.slice(0, 200)}`);
  }

  // ── Readback ───────────────────────────────────────────────────────────────
  const job = (await db.collection("jobs").doc(jobId).get()).data() ?? {};
  const bk = (await db.collection("bookings").doc(booking.id).get()).data() ?? {};
  const inv = await db.collection("invoices").where("jobId", "==", jobId).limit(1).get();
  log("READBACK job", { status: job.status, paymentStatus: job.paymentStatus });
  log("READBACK booking", { status: bk.status });
  log("READBACK invoice", inv.empty ? "none" : { id: inv.docs[0].id, status: inv.docs[0].data().status, total: inv.docs[0].data().totalAmount });
  console.warn("[journey] COMPLETE");
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error("[journey] FAILED:", err);
    process.exit(1);
  });
}
