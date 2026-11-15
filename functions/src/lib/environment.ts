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
// The live Firebase project is "autodeck-studio"; "autodeck-prod" is kept for a future split.
const PRODUCTION_PROJECT_IDS = new Set(["autodeck-prod", "autodeck-studio"]);

export function isProductionProject(): boolean {
  return PRODUCTION_PROJECT_IDS.has(process.env["GCLOUD_PROJECT"] ?? "");
}

// App Check is switched OFF for now (requested 5 Oct 2026: not needed
// before launch). Every callable still reads `enforceAppCheck:
// shouldEnforceAppCheck()`, so turning it back on later is a single deploy
// with APP_CHECK_ENFORCE=true in the function environment - no code edits -
// once the web apps send App Check tokens again. Never enforced in the emulator.
export function shouldEnforceAppCheck(): boolean {
  if (process.env["FUNCTIONS_EMULATOR"] === "true") return false;
  return process.env["APP_CHECK_ENFORCE"] === "true";
}
