/**
 * FINITE live proof (insurance record, no photo): the ACTUAL mounted garage detail
 * screen drives the REAL client paper-service over the REAL callable protocol with
 * REAL auth (emulator custom-claims sign-in), the record persists PENDING, and the
 * REAL Firestore listener readback renders it in the document list. No mocked
 * screen, no direct .run, no mocked service: only device-only seams are stubbed
 * (image picker, expo-router params, deterministic op ids, AsyncStorage).
 *
 * Scope honestly bounded: this proves the insurance-record-only flow end to end
 * while the signed-photo door remains unproven locally (storage emulator answers
 * 501 to signed-URL PUT by implementation; see functions' real-transport suite).
 */
import { describe, expect, it, beforeAll } from "vitest";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { createElement } from "react";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { TextInput } from "react-native";
import { __params } from "../../../../test/stubs/expo-router";

// Admin SDK is TEST SETUP ONLY (seed the owned vehicle; mint the sign-in token).
// It is loaded from the functions package, which owns the dependency.
// Minimal shapes only - firebase-admin types live in the functions package, not here.
type AdminApp = { name: string };
type AdminDocRef = { set(d: Record<string, unknown>): Promise<unknown>; get(): Promise<{ exists: boolean; data(): Record<string, unknown> | undefined }> };
type AdminFireStore = { collection(n: string): { doc(id: string): AdminDocRef } };
const fnRequire = createRequire(path.resolve(__dirname, "../../../../functions/package.json"));
const adminApp = fnRequire("firebase-admin/app") as {
  initializeApp(opts: Record<string, unknown>): AdminApp;
  cert(opts: Record<string, unknown>): unknown;
  getApps(): AdminApp[];
};
const { initializeApp, cert, getApps } = adminApp;
const { getAuth } = fnRequire("firebase-admin/auth") as { getAuth(): { createCustomToken(uid: string, claims: Record<string, unknown>): Promise<string> } };
const { getFirestore } = fnRequire("firebase-admin/firestore") as { getFirestore(): AdminFireStore };

import { auth as clientAuth } from "../../../lib/firebase";
import { signInWithCustomToken } from "firebase/auth";
import VehicleDetailScreen from "./[id]";

const UID = "live-cust-1";
const TENANT = "t";
const VID = "v-live-1";
const REF = "POL-LIVE-101";
const OP_ID = "00000000-0000-4000-8000-000000000001"; // first id the expo-crypto stub hands the form

function textOf(el: ReactTestRenderer): string {
  const walk = (n: unknown): string => {
    if (n == null || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk((n as { children?: unknown }).children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
}
function press(el: ReactTestRenderer, label: string) {
  const node = el.root.findAll((n) => n.props?.label === label && typeof n.props?.onPress === "function")[0];
  if (!node) throw new Error(`no pressable labelled ${label}`);
  node.props.onPress();
}
async function waitFor(el: ReactTestRenderer, what: string, pred: () => boolean, ms = 30_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    if (pred()) return;
  }
  throw new Error(`timed out waiting for ${what}. Tree now:\n${textOf(el).slice(0, 1200)}`);
}

beforeAll(async () => {
  if (!getApps().length) {
    initializeApp({
      projectId: "autodeck-dev",
      credential: cert({
        projectId: "autodeck-dev",
        clientEmail: process.env["TEST_SIGN_CLIENT_EMAIL"]!,
        privateKey: readFileSync(process.env["TEST_SIGN_PRIVATE_KEY_PATH"]!, "utf8"),
      }),
    });
  }
  const adb = getFirestore();
  await adb.collection("vehicles").doc(VID).set({
    id: VID, tenantId: TENANT, ownerId: UID, registrationNumber: "GJ01ZX9999",
    make: "Honda", model: "City", year: "2022", color: "White", category: null,
    photoUrl: null, deletedAt: null, createdAt: "c", updatedAt: "u",
  });
  const token = await getAuth().createCustomToken(UID, { role: "customer", tenantId: TENANT });
  await signInWithCustomToken(clientAuth, token);
  __params.current = { id: VID };
});

describe("LIVE: mounted insurance form -> real callable auth -> PENDING -> real listener readback", () => {
  it("the saved insurance record renders from the real listener with review copy and no coverage claim", async () => {
    let el!: ReactTestRenderer;
    await act(async () => { el = create(createElement(VehicleDetailScreen)); });
    await waitFor(el, "the seeded vehicle", () => textOf(el).includes("Honda City"));
    expect(textOf(el)).toContain("GJ 01 ZX 9999"); // plate rendering of GJ01ZX9999

    await act(async () => { press(el, "Add a document"); });
    await act(async () => {
      const input = el.root.findAllByType(TextInput).find((n) => n.props.placeholder === "Enter number");
      if (!input) throw new Error("document number field not rendered");
      input.props.onChangeText(REF);
    });
    await act(async () => { press(el, "Submit for verification"); });

    // The REAL listener readback: the record the callable persisted renders in the list.
    await waitFor(el, "the saved insurance record in the document list", () => textOf(el).includes(REF));
    const tree = textOf(el);
    expect(tree).toContain("Insurance");
    expect(tree).toContain("Document under studio review"); // PENDING review copy, from the record itself
    expect(tree).not.toContain("insured"); // never a coverage claim
    expect(tree).not.toContain("active cover");
    expect(tree).not.toContain("Can't add this document");
    expect(tree).not.toContain("This number is already saved");

    // The persisted record itself, read back through Admin (setup-only): exactly the
    // insurance-record-only truth - PENDING, no evidence binding, this form session's op id.
    const papers = getFirestore().collection("papers") as unknown as {
      where(f: string, op: string, v: unknown): { where(f: string, op: string, v: unknown): { limit(n: number): { get(): Promise<{ size: number; docs: { data(): Record<string, unknown> }[] }> } } };
    };
    const snap = await papers.where("submissionId", "==", OP_ID).where("vehicleId", "==", VID).limit(2).get();
    expect(snap.size).toBe(1); // exactly one record: the op id deduped, no double submit
    const rec = snap.docs[0]!.data();
    expect(rec).toMatchObject({
      kind: "INSURANCE", reference: REF, status: "PENDING", vehicleId: VID,
      tenantId: TENANT, customerId: UID, studioId: "studio-ahmedabad", submittedBy: "customer",
    });
    expect(rec.evidencePath ?? null).toBeNull();
    expect(rec.expectedContentMd5 ?? null).toBeNull();
    expect(rec.uploadedGeneration ?? null).toBeNull();
  });
});
