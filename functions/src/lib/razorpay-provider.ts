// RazorpayProvider — production payment provider for India.
// In development (USE_PAYMENT_MOCK=true or emulator context), the mock provider
// is used instead. This file is NEVER called with real credentials in development.
//
// PAID SERVICE: Razorpay transaction fees apply in production.
// Sandbox is free. REQUIRES APPROVAL before production activation.
import type {
  PaymentProvider,
  CreatePaymentLinkParams,
  PaymentLinkResult,
  InitiateRefundParams,
  RefundResult,
  VerifyWebhookParams,
  ProviderWebhookEvent,
} from "./payment-provider.js";
import { createHmac } from "node:crypto";
import { isProductionProject } from "./environment.js";
import { mockProvider } from "./mock-payment-provider.js";

interface RazorpayPaymentLinkResponse {
  id: string;
  short_url: string;
  order_id?: string;
}

interface RazorpayRefundResponse {
  id: string;
}

interface RazorpayWebhookPayload {
  id: string;
  event: string;
  payload?: {
    payment?: { entity?: { id?: string; amount?: number; currency?: string } };
    refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    payment_link?: { entity?: { id?: string } };
  };
}

export class RazorpayProvider implements PaymentProvider {
  readonly name = "razorpay";

  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly webhookSecret: string;
  private readonly baseUrl = "https://api.razorpay.com/v1";

  constructor(keyId: string, keySecret: string, webhookSecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
    this.webhookSecret = webhookSecret;
  }

  private get authHeader() {
    const credentials = Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64");
    return `Basic ${credentials}`;
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
    const response = await fetch(`${this.baseUrl}/payment_links`, {
      method: "POST",
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        customer: {
          name: params.customerName,
          contact: params.customerPhone,
        },
        reference_id: params.referenceId,
        notes: { bookingId: params.bookingId },
        callback_url: null, // handled via webhook
        callback_method: null,
      }),
    });

    if (!response.ok) {
      throw new Error(`Razorpay createPaymentLink failed: ${response.status}`);
    }

    const data = (await response.json()) as RazorpayPaymentLinkResponse;
    return {
      providerPaymentLinkId: data.id,
      providerOrderId: data.order_id ?? null,
      paymentUrl: data.short_url,
    };
  }

  verifyWebhookSignature(params: VerifyWebhookParams): boolean {
    const expected = createHmac("sha256", this.webhookSecret)
      .update(params.rawBody)
      .digest("hex");
    return expected === params.signature;
  }

  parseWebhookEvent(rawBody: string): ProviderWebhookEvent {
    const body = JSON.parse(rawBody) as RazorpayWebhookPayload;
    const eventType = body.event as ProviderWebhookEvent["eventType"];
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const plink = body.payload?.payment_link?.entity;

    return {
      eventType,
      providerEventId: body.id,
      providerPaymentId: payment?.id ?? refund?.payment_id ?? "",
      providerPaymentLinkId: plink?.id ?? null,
      providerRefundId: refund?.id ?? null,
      amount: payment?.amount ?? refund?.amount ?? 0,
      currency: payment?.currency ?? "INR",
    };
  }

  async initiateRefund(params: InitiateRefundParams): Promise<RefundResult> {
    const response = await fetch(
      `${this.baseUrl}/payments/${params.providerPaymentId}/refund`,
      {
        method: "POST",
        headers: {
          Authorization: this.authHeader,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: params.amount,
          notes: { reason: params.reason },
          receipt: params.referenceId,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Razorpay initiateRefund failed: ${response.status}`);
    }

    const data = (await response.json()) as RazorpayRefundResponse;
    return { providerRefundId: data.id };
  }
}

// Factory — returns mock in emulator/dev, real provider in production.
// NEVER pass real credentials in development.
export function getPaymentProvider(): PaymentProvider {
  const useMock =
    process.env["USE_PAYMENT_MOCK"] === "true" ||
    process.env["FUNCTIONS_EMULATOR"] === "true" ||
    !process.env["RAZORPAY_KEY_ID"];

  if (useMock) {
    // Phase 5B P1-10 fix: previously, a missing RAZORPAY_KEY_ID (or an
    // accidentally-set USE_PAYMENT_MOCK/FUNCTIONS_EMULATOR) in the actual
    // production project silently substituted the mock provider — real
    // payment links would silently become fake mock-razorpay.local URLs
    // with no error anywhere, breaking customer payment collection
    // invisibly. Fail loudly instead: a missing production secret must be
    // fixed, never silently worked around.
    if (isProductionProject()) {
      throw new Error(
        "Refusing to use the mock payment provider in the production Firebase project " +
          "(autodeck-prod). RAZORPAY_KEY_ID is missing, or USE_PAYMENT_MOCK/FUNCTIONS_EMULATOR " +
          "is set in production configuration — fix the production secret/config instead of " +
          "silently falling back to mock payments.",
      );
    }
    return mockProvider;
  }

  const keyId = process.env["RAZORPAY_KEY_ID"] ?? "";
  const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? "";
  const webhookSecret = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";
  return new RazorpayProvider(keyId, keySecret, webhookSecret);
}
