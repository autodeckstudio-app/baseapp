// MockPaymentProvider — used in all emulator/test/development environments.
// Never calls any external API. Returns deterministic, controllable results.
// NOT for production use.
import type {
  PaymentProvider,
  RefundLookupResult, RefundBinding,
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
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number; currency?: string; status?: string; receipt?: string | null } };
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
      providerRefundAmount: refund?.amount ?? null,
      providerRefundCurrency: refund?.currency ?? null,
      providerRefundPaymentId: refund?.payment_id ?? null,
      providerPaymentEntityId: payment?.id ?? null,
      providerPaymentEntityCurrency: payment?.currency ?? null,
      providerRefundStatus: refund?.status ?? null,
      providerRefundReceipt: refund?.receipt ?? null,
      amount: payment?.amount ?? refund?.amount ?? 0,
      currency: payment?.currency ?? "INR",
    };
  }

  // Test hook: when set, initiateRefund "succeeds" server-side but the
  // response is lost (the ambiguous-submit case). The lookup still finds it.
  loseNextRefundResponse = false;
  private submitted = new Map<string, RefundResult & InitiateRefundParams>();

  async initiateRefund(params: InitiateRefundParams): Promise<RefundResult> {
    const result = { providerRefundId: this.mockRefundId(params.referenceId), ...params };
    this.submitted.set(params.referenceId, result);
    if (this.loseNextRefundResponse) {
      this.loseNextRefundResponse = false;
      throw new Error("network: response lost after provider accepted");
    }
    return result;
  }

  // When false (default), a miss reports "unknown" (inconclusive) — matching
  // providers with no authoritative negative lookup. Set true in tests to
  // model a provider whose reconciliation contract confirms absence.
  authoritativeNegatives = false;

  async findRefundByReference(referenceId: string, binding: RefundBinding): Promise<RefundLookupResult> {
    const hit = this.submitted.get(referenceId);
    // Bound like the real adapter: identity only when payment id, amount and
    // currency all agree; a partial match is held as unknown, never attached.
    if (hit && hit.providerPaymentId === binding.providerPaymentId
        && hit.amount === binding.amountPaise
        && ((hit as { currency?: string }).currency ?? "INR") === binding.currency) {
      return { outcome: "found", providerRefundId: hit.providerRefundId };
    }
    if (hit) return { outcome: "unknown" };
    return this.authoritativeNegatives ? { outcome: "absent_confirmed" } : { outcome: "unknown" };
  }
}

export const mockProvider = new MockPaymentProvider();
