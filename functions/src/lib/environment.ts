// Single source of truth for "is this Cloud Function actually running in the
// production Firebase project" — used as a defense-in-depth guard that must
// hold even if a dev/mock env var (USE_PAYMENT_MOCK, FUNCTIONS_EMULATOR) is
// ever accidentally set in the production environment's own configuration
// (Phase 5B P1-10/P1-11 — a single misconfigured env var must not be
// sufficient, on its own, to enable mock/bypass payment behavior in prod).
// GCLOUD_PROJECT is populated automatically by the Cloud Functions runtime
// (and set explicitly to "autodeck-dev" by the emulator test harness — see
// emulator-setup.ts) — not something a deploy can forget to configure, unlike
// an application-defined env var.
const PRODUCTION_PROJECT_ID = "autodeck-prod";

export function isProductionProject(): boolean {
  return process.env["GCLOUD_PROJECT"] === PRODUCTION_PROJECT_ID;
}

// Phase 5B P1-13: whether a callable should enforce Firebase App Check.
// FUNCTIONS_EMULATOR is populated automatically by the real Cloud Functions
// emulator runtime at cold start — not an application-defined env var
// someone could forget to set, unlike USE_PAYMENT_MOCK. This deliberately
// does NOT use isProductionProject(): enforcement should hold in every
// REAL deployment (dev/staging/prod), not just the "autodeck-prod" project,
// so that a caller without a valid App Check token is rejected the moment a
// function is actually deployed, not only once it reaches production. The
// Firebase Functions emulator has a known bug (firebase-tools#5253) where
// enforceAppCheck:true rejects callable requests even though the emulator
// cannot itself verify App Check tokens — so enforcement is switched off
// only for that one specific, auto-detected context.
export function shouldEnforceAppCheck(): boolean {
  return process.env["FUNCTIONS_EMULATOR"] !== "true";
}
