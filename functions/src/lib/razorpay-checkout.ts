// Razorpay Standard Checkout helpers: create an order and verify the signature
// the checkout modal returns. The key secret is read from the function secret
// config only. The amount always comes from the stored payment, never the client.
import { createHmac, timingSafeEqual } from "node:crypto";

const BASE = "https://api.razorpay.com/v1";

export function checkoutSignature(orderId: string, paymentId: string, secret: string): string {
  return createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
}

export function signatureMatches(orderId: string, paymentId: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(checkoutSignature(orderId, paymentId, secret), "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function createRazorpayOrder(params: { amount: number; currency: string; receipt: string; keyId: string; keySecret: string }): Promise<{ id: string; amount: number; currency: string }> {
  if (!Number.isInteger(params.amount) || params.amount < 100) throw new Error("Amount must be at least 100 paise.");
  const res = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${params.keyId}:${params.keySecret}`).toString("base64")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: params.amount, currency: params.currency, receipt: params.receipt.slice(0, 40) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    let reason = "";
    try { reason = (JSON.parse(detail) as { error?: { description?: string } }).error?.description ?? ""; } catch { /* non-JSON body */ }
    throw new Error(`Razorpay order failed: ${res.status}${reason ? ` (${reason})` : ""}`);
  }
  return (await res.json()) as { id: string; amount: number; currency: string };
}
