import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

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
