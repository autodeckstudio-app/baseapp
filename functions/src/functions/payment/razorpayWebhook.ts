// Razorpay -> AutoDeck webhook (HTTP). Verifies the HMAC signature on the RAW body, then hands the
// event to processProviderEvent. Replies 200 for everything validly signed (so Razorpay does not
// retry events we deliberately ignore), 401 for a bad signature, 500 only when processing threw
// (Razorpay then retries; the handler is idempotent).
//
// Reads RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET from Secret Manager (bound via `secrets`).
// URL is a separate, approved step.
import { onRequest } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { getPaymentProvider } from "../../lib/razorpay-provider.js";
import { processProviderEvent } from "../../lib/razorpay-webhook.js";

export const razorpayWebhook = onRequest({ region: "asia-south1", maxInstances: 5, secrets: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET"] }, async (req, res) => {
  if (req.method !== "POST") { res.status(405).send("method not allowed"); return; }
  const raw = req.rawBody ? req.rawBody.toString("utf8") : "";
  const signature = String(req.header("x-razorpay-signature") ?? "");
  const provider = getPaymentProvider();
  if (!raw || !provider.verifyWebhookSignature({ rawBody: raw, signature })) {
    res.status(401).send("invalid signature");
    return;
  }
  try {
    const ev = provider.parseWebhookEvent(raw);
    const headerId = String(req.header("x-razorpay-event-id") ?? "");
    if (headerId) ev.providerEventId = headerId;
    const result = await processProviderEvent(getFirestore(), ev);
    res.status(200).json(result);
  } catch (err) {
    console.error("razorpayWebhook failed", err instanceof Error ? err.message : err);
    res.status(500).send("processing failed");
  }
});
