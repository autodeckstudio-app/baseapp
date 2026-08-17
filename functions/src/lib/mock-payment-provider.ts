// MockPaymentProvider — used in all emulator/test/development environments.
// Never calls any external API. Returns deterministic, controllable results.
// NOT for production use.
import type {
  PaymentProvider,
  CreatePaymentLinkParams,
  PaymentLinkResult,
  InitiateRefundParams,
  RefundResult,
  VerifyWebhookParams,
  ProviderWebhookEvent,
} from "./payment-provider.js";

export class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock";

  // Deterministic IDs for emulator test assertions
  private mockPaymentLinkId(referenceId: string) {
    return `mock_plink_${referenceId}`;
  }
  private mockRefundId(referenceId: string) {
    return `mock_rfnd_${referenceId}`;
  }

  async createPaymentLink(params: CreatePaymentLinkParams): Promise<PaymentLinkResult> {
    return {
      providerPaymentLinkId: this.mockPaymentLinkId(params.referenceId),
      providerOrderId: `mock_order_${params.referenceId}`,
      paymentUrl: `https://mock-razorpay.local/pay/${params.referenceId}?amount=${params.amount}`,
    };
  }

  verifyWebhookSignature(_params: VerifyWebhookParams): boolean {
    // Mock always accepts — never validate signatures in dev
    return true;
  }

  parseWebhookEvent(rawBody: string): ProviderWebhookEvent {
    const parsed: unknown = JSON.parse(rawBody);
    const body = parsed as {
      event?: string;
      payload?: {
        payment?: { entity?: { id?: string; amount?: number; currency?: string } };
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
        payment_link?: { entity?: { id?: string } };
      };
      id?: string;
    };
    const eventType = (body.event ?? "payment.captured") as ProviderWebhookEvent["eventType"];
    const payment = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const plink = body.payload?.payment_link?.entity;

    return {
      eventType,
      providerEventId: body.id ?? `mock_event_${Date.now()}`,
      providerPaymentId: payment?.id ?? refund?.payment_id ?? "mock_pay_id",
      providerPaymentLinkId: plink?.id ?? null,
      providerRefundId: refund?.id ?? null,
      amount: payment?.amount ?? refund?.amount ?? 0,
      currency: payment?.currency ?? "INR",
    };
  }

  async initiateRefund(params: InitiateRefundParams): Promise<RefundResult> {
    return { providerRefundId: this.mockRefundId(params.referenceId) };
  }
}

export const mockProvider = new MockPaymentProvider();
