/**
 * Regression coverage for Phase 5B P1-10 / P1-11: neither the real payment
 * provider factory nor the dev-only mock-confirmation callable may ever
 * silently behave as mock/bypass when actually running in the production
 * Firebase project (autodeck-prod), regardless of which dev/mock env vars
 * happen to be set. GCLOUD_PROJECT is temporarily overridden per-test and
 * always restored — it is NOT read by anything else in this suite (Admin
 * SDK is already bound to the emulator project via the initializeApp() call
 * in emulator-setup.ts), so this override only affects the code under test.
 *
 * Run with: pnpm test:emulator (requires Firestore Emulator at localhost:8080).
 */
import { describe, it, expect, afterEach } from "vitest";

import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { confirmPaymentMock } from "../../functions/payment/confirmPaymentMock.js";

const ORIGINAL_PROJECT = process.env["GCLOUD_PROJECT"];

afterEach(() => {
  if (ORIGINAL_PROJECT === undefined) {
    delete process.env["GCLOUD_PROJECT"];
  } else {
    process.env["GCLOUD_PROJECT"] = ORIGINAL_PROJECT;
  }
});

describe("getPaymentProvider — production fail-closed (Phase 5B P1-10)", () => {
  it("throws instead of silently returning the mock provider when RAZORPAY_KEY_ID is missing in production", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-prod";
    expect(process.env["RAZORPAY_KEY_ID"]).toBeFalsy(); // ambient test env never sets a real key

    expect(() => getPaymentProvider()).toThrow(/production Firebase project/);
  });

  it("throws even if USE_PAYMENT_MOCK is accidentally set in production", () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-prod";
    // Deliberately not restored afterward — other test files in this suite
    // set USE_PAYMENT_MOCK="true" once at module load and rely on it
    // staying true for the rest of the run (fileParallelism: false, shared
    // process); unsetting it here would break their later tests.
    process.env["USE_PAYMENT_MOCK"] = "true";
    expect(() => getPaymentProvider()).toThrow(/production Firebase project/);
  });

  // "Still works unchanged outside production" is covered by every other
  // emulator test that exercises a razorpay_payment_link payment (e.g.
  // initiatePayment/initiateRefund in payment-confirm.emulator.test.ts) —
  // all of them call getPaymentProvider() successfully with
  // GCLOUD_PROJECT="autodeck-dev" throughout this suite.
});

describe("confirmPaymentMock — production defense-in-depth (Phase 5B P1-11)", () => {
  it("refuses to run in production even with USE_PAYMENT_MOCK=true", async () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-prod";
    process.env["USE_PAYMENT_MOCK"] = "true";
    await expect(
      confirmPaymentMock.run({
        data: { paymentId: "any-payment-id", mockResult: "success" },
        auth: undefined,
      } as never),
    ).rejects.toThrow(/only available in emulator\/dev environments/);
  });

  it("refuses to run in production even with FUNCTIONS_EMULATOR=true", async () => {
    process.env["GCLOUD_PROJECT"] = "autodeck-prod";
    process.env["FUNCTIONS_EMULATOR"] = "true";
    // Not restored afterward — see note above; other tests may legitimately
    // depend on FUNCTIONS_EMULATOR/USE_PAYMENT_MOCK staying "true" for the
    // rest of this shared-process run.
    await expect(
      confirmPaymentMock.run({
        data: { paymentId: "any-payment-id", mockResult: "success" },
        auth: undefined,
      } as never),
    ).rejects.toThrow(/only available in emulator\/dev environments/);
  });
});
