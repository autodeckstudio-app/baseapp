// Phase 5B P1-15: server-only Firebase Admin SDK client for the session-
// cookie exchange. Deliberately has NO "use client" directive and is only
// ever imported from Route Handlers (src/app/api/session/route.ts) and
// middleware-adjacent server code — files Next.js never includes in the
// client bundle. Do not import this from any "use client" component or any
// module reachable from one: the service-account credential path below
// must never reach browser JS.
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Cloud Run and Cloud Functions Gen2 — and Firebase App Hosting, which
// deploys on Cloud Run under the hood — set K_SERVICE automatically as part
// of the Knative-based execution environment. It is not something a human
// sets, and it is not present on Vercel or any other non-GCP host, which
// makes it a reliable signal that Application Default Credentials will
// actually be available. If this app's eventual hosting target turns out
// to be some other GCP-native compute that doesn't set K_SERVICE, this
// heuristic will need revisiting — but it covers every candidate evaluated
// in the Phase 5C audit (App Hosting, Cloud Run, Vercel).
function isGcpNativeCompute(): boolean {
  return Boolean(process.env["K_SERVICE"]);
}

function initAdminApp(): App {
  const existing = getApps();
  if (existing[0]) return existing[0];

  // Auth Emulator: mirrors functions/src/test/emulator-setup.ts. The Admin
  // SDK auto-detects FIREBASE_AUTH_EMULATOR_HOST and talks to the emulator
  // without needing real credentials.
  if (process.env["FIREBASE_AUTH_EMULATOR_HOST"]) {
    return initializeApp({ projectId: process.env["GCLOUD_PROJECT"] ?? "autodeck-dev" });
  }

  // Real deployment. This app's hosting target is not yet decided (no
  // firebase.json "hosting" config, no vercel.json/apphosting.yaml exist in
  // this repo as of Phase 5B) — unlike Cloud Functions, which can always
  // call initializeApp() bare and rely on Application Default Credentials
  // from its own execution environment, a Next.js server might end up
  // running somewhere that has no metadata-server-based ADC available (e.g.
  // Vercel). Support both paths rather than assuming one:
  //   - FIREBASE_SERVICE_ACCOUNT_KEY: a service-account JSON string, for
  //     hosts with no ADC (set as a secret env var, never committed).
  //   - applicationDefault(): for GCP-native hosts (Firebase App Hosting,
  //     Cloud Run) that provide ADC automatically via an attached service
  //     account — no explicit credential needed there.
  const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT_KEY"];
  if (serviceAccountJson) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccountJson) as object) });
  }
  if (isGcpNativeCompute()) {
    return initializeApp({ credential: applicationDefault() });
  }

  // Phase 5C Batch 1: neither a service-account key nor a GCP-native ADC
  // marker is present. Falling through to applicationDefault() here would
  // have failed anyway, but only on the FIRST real request, with a raw
  // Google Auth Library error — not the clear boot-time throw every other
  // production config guard in this app uses (see
  // apps/admin/src/lib/firebase.ts's NEXT_PUBLIC_FIREBASE_PROJECT_ID/
  // NEXT_PUBLIC_RECAPTCHA_SITE_KEY checks). Fail the same way here instead.
  // Never include the (absent) secret's value — only the env var's name.
  throw new Error(
    "Firebase Admin SDK has no credential source: FIREBASE_SERVICE_ACCOUNT_KEY is not set, and this does not look like a GCP-native host (no K_SERVICE env var found). " +
      "Set FIREBASE_SERVICE_ACCOUNT_KEY if deploying to a non-GCP host (e.g. Vercel), or deploy to a GCP-native host (Firebase App Hosting, Cloud Run) where Application Default Credentials are provided automatically.",
  );
}

export const adminAuth = getAuth(initAdminApp());
