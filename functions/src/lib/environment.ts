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
