import type { PaymentLinkResult, PaymentProvider } from './payment-provider.js';
import type { VisitProviderPort, VisitProviderDiscoveryPort } from './visit-provider-runner.js';
import { assertVisitProviderCandidate } from './visit-provider-recovery.js';

type Fetched = NonNullable<Awaited<ReturnType<PaymentProvider['fetchPaymentLink']>>>;
export type VisitProviderHttpRequest = { method: 'GET' | 'POST'; path: string; body?: Record<string, unknown> };
export type VisitProviderHttpTransport = (request: VisitProviderHttpRequest) => Promise<{ status: number; body: unknown }>;
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(v);
const reference = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v);
const object = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const fail = (): never => { throw new Error('Visit payment provider response needs review.'); };
function candidate(raw: unknown): PaymentLinkResult {
  if (!object(raw)) return fail();
  const result = { providerPaymentLinkId: raw['id'], providerOrderId: raw['order_id'] ?? null, paymentUrl: raw['short_url'] };
  assertVisitProviderCandidate(result);
  return result;
}
function fetched(raw: unknown): Fetched {
  const result = candidate(raw);
  if (!object(raw) || !['created','partially_paid','paid','expired','cancelled'].includes(raw['status']) ||
    !Number.isSafeInteger(raw['amount']) || raw['amount'] <= 0 || raw['currency'] !== 'INR' ||
    !reference(raw['reference_id']) || !Number.isSafeInteger(raw['amount_paid']) || raw['amount_paid'] < 0 || raw['amount_paid'] > raw['amount'] ||
    !Array.isArray(raw['payments']) || raw['accept_partial'] !== false || raw['upi_link'] !== false) return fail();
  // Keep actual provider values. Missing currency/reference/amount never inherit
  // the request. A fetched paid entity is still not captured-money proof.
  return { ...result, status: raw['status'], amount: raw['amount'], currency: raw['currency'],
    evidence: { referenceId: raw['reference_id'], amountPaid: raw['amount_paid'], payments: raw['payments'] } };
}

/** DORMANT protocol adapter. The caller must inject its HTTP transport; there
 * is deliberately no global fetch, credential access, provider factory,
 * callable, scheduler or webhook wiring in this module. No network request is
 * made merely by constructing it. The production activation hold remains.
 *
 * Visit IDs never enter legacy bookingId notes. Notifications/reminders and
 * provider partial-payment collection are explicitly disabled on creation.
 * Only the committed one-submit runner may eventually call create.
 *
 * Official API contracts checked 15 Nov 2026:
 * https://razorpay.com/docs/api/payments/payment-links/create-standard
 * https://razorpay.com/docs/us/api/payments/payment-links/fetch-all-standard
 * https://razorpay.com/docs/us/api/payments/payment-links/fetch-id-standard
 */
export class RazorpayVisitProtocol implements VisitProviderPort, VisitProviderDiscoveryPort {
  constructor(private readonly http: VisitProviderHttpTransport) {}
  async createVisitPaymentLink(input: Parameters<VisitProviderPort['createVisitPaymentLink']>[0]): Promise<PaymentLinkResult> {
    if (!input || !id(input.visitId) || !id(input.billId) || !reference(input.referenceId) ||
      input.currency !== 'INR' || !Number.isSafeInteger(input.amountPaise) || input.amountPaise <= 0) return fail();
    const response = await this.http({ method: 'POST', path: '/payment_links', body: {
      amount: input.amountPaise, currency: input.currency, reference_id: input.referenceId,
      description: 'Reviewed visit balance', accept_partial: false, upi_link: false,
      notify: { sms: false, email: false }, reminder_enable: false,
      notes: { kind: 'shared_visit', visitId: input.visitId, billId: input.billId },
    } });
    if (response.status < 200 || response.status >= 300) return fail();
    // Creation is only a candidate. The sequencer saves it before an independent
    // GET verifies the stored original reference, amount and currency.
    return candidate(response.body);
  }
  async fetchPaymentLink(linkId: string): Promise<Fetched | null> {
    if (!id(linkId)) return fail();
    const response = await this.http({ method: 'GET', path: '/payment_links/' + encodeURIComponent(linkId) });
    if (response.status === 404) return null;
    if (response.status < 200 || response.status >= 300) return fail();
    const result = fetched(response.body);
    if (result.providerPaymentLinkId !== linkId) return fail();
    return result;
  }
  async findVisitPaymentLinks(referenceId: string) {
    if (!reference(referenceId)) return fail();
    const response = await this.http({ method: 'GET', path: '/payment_links?reference_id=' + encodeURIComponent(referenceId) });
    if (response.status < 200 || response.status >= 300 || !object(response.body) ||
      Object.keys(response.body).some(k => k !== 'payment_links') || !Array.isArray(response.body['payment_links'])) return fail();
    const rows = response.body['payment_links'];
    // The documented response is a payment_links array. Unexpected pagination
    // fields or an implausibly large result are inconclusive, not a safe miss.
    // The provider documents reference_id as unique. Still reject duplicates.
    if (rows.length > 1) return { complete: false, links: [] as Fetched[] };
    const links = rows.map(fetched);
    if (links.some(link => link.evidence?.referenceId !== referenceId)) return fail();
    return { complete: true, links };
  }
}
