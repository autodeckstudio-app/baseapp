// Phase 5B P1-15: server-only Firebase Admin SDK client for the session-
// cookie exchange. Deliberately has NO "use client" directive and is only
// ever imported from Route Handlers (src/app/api/session/route.ts) and
// middleware-adjacent server code — files Next.js never includes in the
// client bundle. Do not import this from any "use client" component or any
// module reachable from one: the service-account credential path below
// must never reach browser JS.
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

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
  return initializeApp({ credential: applicationDefault() });
}

export const adminAuth = getAuth(initAdminApp());
