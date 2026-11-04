/**
 * Live-SDK identity journey against the local emulator suite (demo-autodeck
 * only): REAL firebase.ts clients, REAL auth-service, REAL useAuth, REAL
 * claim screen and REAL Bookings route. Only device seams are stubbed
 * (expo-router capture, imagery assets, native kit shells, push, Razorpay,
 * catalogue callable). Requires the emulator suite running (Auth 9099,
 * Firestore 8099, Functions 5001) and demo/livesdk/seed.mjs applied.
 *
 * Proves: sign-in -> resolveMyCustomerDocId is null while unclaimed
 * (claimRequired, nothing created) -> real claim screen types the counter
 * code and lands on /(tabs) -> token claims carry role/tenant -> canonical
 * id resolves and persists -> useAuth reaches ready with the STAGED doc id
 * (!= auth uid) -> Bookings lists the seeded visit through the canonical id
 * -> the real Track handler routes to the linked booking. Then the
 * self-serve setup path for a brand-new verified email creates id == uid.
 */
import { writeFileSync } from "node:fs";
import React, { createElement } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

const h = vi.hoisted(() => ({ routes: [] as unknown[] }));
const __params = vi.hoisted(() => ({ current: {} as Record<string, string> }));

vi.mock("expo-router", () => ({
  useSegments: () => [],
  useLocalSearchParams: () => __params.current,
  useRouter: () => ({
    replace: (p: unknown) => h.routes.push(p),
    push: (p: unknown) => h.routes.push(p),
    back: () => {},
  }),
  useFocusEffect: (cb: () => void) => React.useEffect(cb, [cb]),
  Link: (props: { children?: React.ReactNode }) => props.children ?? null,
}));
vi.mock("@autodeck/ui", () => ({
  formatDateShort: (s: string) => s,
  TextInput: (props: Record<string, unknown>) => React.createElement("input", props),
}));
vi.mock("../../src/lib/imagery", () => ({ sceneImagery: {}, serviceImagery: {}, brandImagery: {} }));
vi.mock("../../src/lib/push", () => ({
  PUSH_ASKED_KEY: "push", requestPush: vi.fn(), registerPushToken: vi.fn(), pushSupported: false,
}));
vi.mock("../../src/lib/razorpay-checkout", () => ({ payWithPaymentLink: vi.fn(), payOnline: vi.fn() }));
vi.mock("../../src/lib/catalogue-service", () => ({ getServiceCatalogue: async () => [] })); // callable catalogue is out of scope for the identity journey
vi.mock("../../src/lib/review-service", () => ({ getReview: async () => null, submitReview: vi.fn() }));
vi.mock("../../src/lib/inspection-service", () => ({ listenToInspection: () => () => {} }));
vi.mock("../../src/ui/CarThumb", () => ({ CarThumb: () => null }));
vi.mock("../../src/ui/PickupCard", () => ({ PickupCard: () => null }));
vi.mock("../../src/ui/ServicePhoto", () => ({ ServicePhoto: () => null }));
vi.mock("../../src/ui/LegalLinks", () => ({ LegalLinks: () => null }));
vi.mock("../../src/hooks/useCustomerHome", () => ({ setActiveVehicle: vi.fn() }));

const EMAIL = "livesdk.walkin@example.com";
const PASSWORD = "livesdk-demo-pass-1";
const FRESH_EMAIL = "livesdk.fresh@example.com";
const FRESH_PASSWORD = "livesdk-demo-pass-2";
const STAGED = "staged-livesdk-1";
const BOOKING = "b-livesdk-1";
const TENANT = "automodz";

type FirebaseMod = typeof import("../../src/lib/firebase");
type AuthServiceMod = typeof import("../../src/lib/auth-service");
let firebase: FirebaseMod;
let as: AuthServiceMod;

async function waitFor(fn: () => boolean, label: string, ms = 20000): Promise<void> {
  const t0 = Date.now();
  for (;;) {
    await act(async () => { await new Promise((r) => setTimeout(r, 200)); });
    if (fn()) return;
    if (Date.now() - t0 > ms) throw new Error(`waitFor timeout: ${label}`);
  }
}

function textOf(r: ReactTestRenderer): string {
  return JSON.stringify(r.toJSON());
}

beforeAll(() => {
  const pid = process.env["EXPO_PUBLIC_FIREBASE_PROJECT_ID"] ?? "";
  if (!pid.startsWith("demo-")) {
    throw new Error(`refusing: EXPO_PUBLIC_FIREBASE_PROJECT_ID must be demo-* (got "${pid}") - never run this fixture against a real backend`);
  }
  if (process.env["USE_FIREBASE_EMULATOR"] !== "true") {
    throw new Error("refusing: USE_FIREBASE_EMULATOR must be exactly 'true'");
  }
});

describe("live-SDK staff-first identity journey (emulator suite)", () => {
  it("claim -> canonical ready -> populated Bookings -> Track", async () => {
    firebase = await import("../../src/lib/firebase");
    as = await import("../../src/lib/auth-service");
    expect(firebase.emulatorBackend).toBe(true);

    const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");

    // 1. Sign in as the walk-in customer (verified email, seeded by seed.mjs).
    await signInWithEmailAndPassword(firebase.auth, EMAIL, PASSWORD);
    const uid = firebase.auth.currentUser!.uid;
    expect(uid).toBeTruthy();
    expect(uid).not.toBe(STAGED);

    // 2. Unclaimed: resolver returns null (claimRequired surface) and creates nothing.
    expect(await as.resolveMyCustomerDocId()).toBeNull();

    // 3. REAL claim screen: type the counter code, continue, land on /(tabs).
    const { default: ClaimScreen } = await import("../../src/app/(auth)/claim");
    let claim: ReactTestRenderer;
    await act(async () => { claim = create(createElement(ClaimScreen)); });
    await act(async () => {
      claim!.root.findByProps({ placeholder: "XXXX-XXXX" }).props.onChangeText("4820-1937");
    });
    await act(async () => {
      claim!.root.findByProps({ testID: "claim-continue" }).props.onPress();
    });
    await waitFor(() => h.routes.includes("/(tabs)"), "claim screen routes to /(tabs)");
    await act(async () => { claim!.unmount(); });

    // 4. Claims and canonical id after claim.
    await as.refreshAuthToken();
    const tok = await firebase.auth.currentUser!.getIdTokenResult();
    expect(tok.claims.role).toBe("customer");
    expect(tok.claims.tenantId).toBe(TENANT);
    expect(await as.resolveMyCustomerDocId()).toBe(STAGED);

    // 5. REAL useAuth reaches ready with the staged doc id.
    const { useAuth } = await import("../../src/hooks/useAuth");
    let authState: { status: string; customerDocId?: string | null } = { status: "init" };
    function Probe() {
      const s = useAuth() as unknown as { status: string; customerDocId?: string | null };
      authState = s;
      return null;
    }
    let probe: ReactTestRenderer;
    await act(async () => { probe = create(createElement(Probe)); });
    await waitFor(() => authState.status === "ready", "useAuth ready");
    expect(authState.customerDocId).toBe(STAGED);
    await act(async () => { probe!.unmount(); });

    // 6. REAL Bookings route lists the seeded visit via the canonical id and
    // the REAL Track handler routes to the linked booking.
    const { default: Bookings } = await import("../../src/app/(tabs)/bookings/index");
    const { Button } = await import("../../src/ui/kit");
    let list: ReactTestRenderer;
    await act(async () => { list = create(createElement(Bookings)); });
    await waitFor(() => textOf(list!).includes("Track"), "Bookings renders Track for the live job");
    writeFileSync("/tmp/livesdk-bookings-tree.json", textOf(list!));
    h.routes.length = 0;
    await act(async () => {
      list!.root.findAllByType(Button).find((b) => b.props.label === "Track")!.props.onPress();
    });
    expect(h.routes).toContain(`/(tabs)/bookings/${BOOKING}`);
    await act(async () => { list!.unmount(); });

    // 7. Self-serve setup path: a brand-new verified email gets id == uid.
    await signOut(firebase.auth);
    await signInWithEmailAndPassword(firebase.auth, FRESH_EMAIL, FRESH_PASSWORD);
    const freshUid = firebase.auth.currentUser!.uid;
    const setupRes = await as.setupCustomerProfile("Fresh Live SDK");
    expect(as.isClaimRequired(setupRes)).toBe(false);
    await as.refreshAuthToken();
    expect(await as.resolveMyCustomerDocId()).toBe(freshUid);
    const tok2 = await firebase.auth.currentUser!.getIdTokenResult();
    expect(tok2.claims.role).toBe("customer");
    expect(tok2.claims.tenantId).toBe(TENANT);
    await signOut(firebase.auth);
  });
});
