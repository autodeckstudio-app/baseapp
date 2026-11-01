import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import * as WebBrowser from "expo-web-browser";
import type { Payment } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "./firebase";

type OrderOut = { orderId: string; amount: number; currency: string; keyId: string };
type RzpResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RzpCtor = new (opts: Record<string, unknown>) => { open: () => void; on: (e: string, cb: () => void) => void };

export const checkoutSupported = Platform.OS === "web";

type Dom = { Razorpay?: RzpCtor; document: { createElement: (t: string) => Record<string, unknown>; head: { appendChild: (n: unknown) => void } } };

function loadScript(): Promise<RzpCtor> {
  const w = globalThis as unknown as Dom;
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = w.document.createElement("script") as { src: string; onload: () => void; onerror: () => void };
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("Checkout did not load.")));
    s.onerror = () => reject(new Error("Could not reach the payment page."));
    w.document.head.appendChild(s);
  });
}

/** Standard Checkout: order from the server, modal in the browser, signature verified on the server. */
export async function payWithCheckout(paymentId: string, opts: { name: string; description: string }): Promise<"paid" | "dismissed" | "failed"> {
  const order = (await httpsCallable<{ paymentId: string }, OrderOut>(functions, "createCheckoutOrder")({ paymentId })).data;
  const Razorpay = await loadScript();
  return new Promise((resolve, reject) => {
    const rzp = new Razorpay({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: opts.name,
      description: opts.description,
      theme: { color: "#1C1C1E" },
      handler: (r: RzpResponse) => {
        void httpsCallable(functions, "verifyCheckoutPayment")({ paymentId, ...r })
          .then(() => resolve("paid"))
          .catch((e: unknown) => reject(e instanceof Error ? e : new Error("Payment could not be verified.")));
      },
      modal: { ondismiss: () => resolve("dismissed") },
    });
    // A failed attempt closes checkout and returns to the booking page with a retry message.
    rzp.on("payment.failed", () => { try { (rzp as unknown as { close?: () => void }).close?.(); } catch { /* already closed */ } resolve("failed"); });
    rzp.open();
  });
}

import { terminalPayOutcome, type OnlinePayOutcome } from "./native-pay-core";
export type { OnlinePayOutcome } from "./native-pay-core";

async function paymentUrlFor(paymentId: string): Promise<string | null> {
  const snap = await getDoc(doc(db, COLLECTIONS.payments(), paymentId));
  return snap.exists() ? ((snap.data() as Payment).paymentUrl ?? null) : null;
}

/**
 * Native (iOS/Android) online pay: open the Razorpay hosted payment page, then wait
 * for the SERVER to settle the payment. The browser's return is never trusted: the
 * only "paid" comes from the Payment doc, which the Razorpay webhook flips after
 * signature-verified capture. If the customer closes the browser or the webhook is
 * slow, the outcome is "pending" - the payment may still complete, and the UI must
 * say so rather than claim success or failure.
 */
export async function payWithPaymentLink(paymentId: string, paymentUrl: string | null): Promise<OnlinePayOutcome> {
  const url = paymentUrl ?? (await paymentUrlFor(paymentId).catch(() => null));
  if (!url) return "failed";
  return new Promise<OnlinePayOutcome>((resolve) => {
    let settled = false;
    let grace: ReturnType<typeof setTimeout> | null = null;
    let cap: ReturnType<typeof setTimeout> | null = null;
    const finish = (outcome: OnlinePayOutcome) => {
      if (settled) return;
      settled = true;
      if (grace) clearTimeout(grace);
      if (cap) clearTimeout(cap);
      unsub();
      resolve(outcome);
    };
    // Attached before the browser opens; onSnapshot also delivers the current doc
    // immediately, so an already-reconciled payment resolves at once.
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.payments(), paymentId),
      (snap) => {
        const terminal = snap.exists() ? terminalPayOutcome((snap.data() as Payment).status) : null;
        if (terminal) finish(terminal);
      },
      () => finish("pending"),
    );
    cap = setTimeout(() => finish("pending"), 180_000);
    void (async () => {
      try {
        await WebBrowser.openBrowserAsync(url);
        // Browser closed with no terminal status yet: give the webhook a short grace window.
        grace = setTimeout(() => finish("pending"), 20_000);
      } catch {
        finish("failed");
      }
    })();
  });
}

/**
 * One entry point for online pay on every platform. Web keeps Razorpay Standard
 * Checkout (payWithCheckout); native uses the hosted payment link above.
 */
export async function payOnline(p: { paymentId: string; paymentUrl: string | null; name: string; description: string }): Promise<OnlinePayOutcome> {
  if (Platform.OS === "web") {
    return payWithCheckout(p.paymentId, { name: p.name, description: p.description });
  }
  return payWithPaymentLink(p.paymentId, p.paymentUrl);
}
