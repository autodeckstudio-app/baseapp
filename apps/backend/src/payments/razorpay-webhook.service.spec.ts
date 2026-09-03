import { createHmac } from 'crypto';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type * as admin from 'firebase-admin';
import type { AuditLogService } from '../audit/audit-log.service';
import type { EnvConfig } from '../config/configuration';
import { RazorpayWebhookService } from './razorpay-webhook.service';

const WEBHOOK_SECRET = 'test-webhook-secret';

function sign(bodyString: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(bodyString).digest('hex');
}

function paymentCapturedPayload(orderId: string, paymentId: string) {
  return { event: 'payment.captured', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } };
}
function paymentFailedPayload(orderId: string, paymentId: string) {
  return { event: 'payment.failed', payload: { payment: { entity: { id: paymentId, order_id: orderId } } } };
}
function refundProcessedPayload(refundId: string, paymentId: string) {
  return { event: 'refund.processed', payload: { refund: { entity: { id: refundId, payment_id: paymentId } } } };
}

function makeQuery(store: Record<string, Record<string, unknown>>, field: string, value: string) {
  const exec = () => {
    const matches = Object.entries(store).filter(([, doc]) => doc[field] === value);
    const docs = matches.map(([id, data]) => ({ ref: { id }, data: () => data }));
    return { empty: docs.length === 0, docs };
  };
  const query: { limit: jest.Mock; __exec: () => unknown } = {
    limit: jest.fn(() => query),
    __exec: exec,
  };
  return query;
}

function buildHarness(
  options: {
    existingPayments?: Record<string, Record<string, unknown>>;
    existingRefunds?: Record<string, Record<string, unknown>>;
  } = {},
) {
  const payments = { ...(options.existingPayments ?? {}) };
  const refunds = { ...(options.existingRefunds ?? {}) };

  const transactionMock = {
    get: jest.fn(async (query: { __exec: () => unknown }) => query.__exec()),
    update: jest.fn(),
  };

  const firestoreMock = {
    collection: jest.fn((name: string) => ({
      where: jest.fn((field: string, _op: string, value: string) => {
        if (name === 'payments') return makeQuery(payments, field, value);
        if (name === 'refunds') return makeQuery(refunds, field, value);
        throw new Error(`unexpected collection in test: ${name}`);
      }),
    })),
    runTransaction: jest.fn((callback: (tx: typeof transactionMock) => Promise<unknown>) => callback(transactionMock)),
  };
  const app = { firestore: () => firestoreMock } as unknown as admin.app.App;
  const auditLogService = {
    recordInTransaction: jest.fn(),
    record: jest.fn(),
    recordInBatch: jest.fn(),
  } as unknown as AuditLogService;
  const configService = { get: jest.fn().mockReturnValue(WEBHOOK_SECRET) } as unknown as ConfigService<
    EnvConfig,
    true
  >;

  const service = new RazorpayWebhookService(app, auditLogService, configService);
  return { service, transactionMock, auditLogService, firestoreMock };
}

describe('RazorpayWebhookService.processWebhook — signature and payload validation', () => {
  it('rejects a missing request body', async () => {
    const { service } = buildHarness();
    await expect(service.processWebhook(undefined, 'whatever')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an invalid signature', async () => {
    const { service } = buildHarness();
    const body = Buffer.from(JSON.stringify(paymentCapturedPayload('order_1', 'pay_1')));
    await expect(service.processWebhook(body, 'not-the-real-signature')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a missing signature header', async () => {
    const { service } = buildHarness();
    const body = Buffer.from(JSON.stringify(paymentCapturedPayload('order_1', 'pay_1')));
    await expect(service.processWebhook(body, undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects malformed JSON even with an otherwise-valid signature', async () => {
    const { service } = buildHarness();
    const body = Buffer.from('not valid json {{{');
    const signature = sign(body.toString('utf8'));
    await expect(service.processWebhook(body, signature)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a validly-signed payload with an unexpected shape', async () => {
    const { service } = buildHarness();
    const body = Buffer.from(JSON.stringify({ foo: 'bar' }));
    const signature = sign(body.toString('utf8'));
    await expect(service.processWebhook(body, signature)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('ignores an unsupported event type without error', async () => {
    const { service } = buildHarness();
    const body = Buffer.from(JSON.stringify({ event: 'order.paid', payload: {} }));
    const signature = sign(body.toString('utf8'));
    await expect(service.processWebhook(body, signature)).resolves.toEqual({ status: 'ignored' });
  });
});

describe('RazorpayWebhookService.processWebhook — payment.captured', () => {
  it('captures a matching payment on first delivery', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingPayments: { 'bk-1': { paymentId: 'bk-1', razorpayOrderId: 'order_1', status: 'created' } },
    });
    const body = Buffer.from(JSON.stringify(paymentCapturedPayload('order_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'processed' });
    expect(transactionMock.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'captured', razorpayPaymentId: 'pay_1' }),
    );
    expect(auditLogService.recordInTransaction).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({ actorId: 'razorpay-webhook', actorRole: 'system', action: 'payment.captured' }),
    );
  });

  it('is idempotent: a duplicate delivery for an already-captured payment applies no effect', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingPayments: {
        'bk-1': { paymentId: 'bk-1', razorpayOrderId: 'order_1', status: 'captured', razorpayPaymentId: 'pay_1' },
      },
    });
    const body = Buffer.from(JSON.stringify(paymentCapturedPayload('order_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'duplicate' });
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('safely ignores a payment.captured event for an unrecognized order', async () => {
    const { service, transactionMock } = buildHarness();
    const body = Buffer.from(JSON.stringify(paymentCapturedPayload('order_unknown', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'ignored' });
    expect(transactionMock.update).not.toHaveBeenCalled();
  });

  it('rejects a malformed payment.captured payload missing order_id', async () => {
    const { service } = buildHarness();
    const body = Buffer.from(
      JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_1' } } } }),
    );
    const signature = sign(body.toString('utf8'));
    await expect(service.processWebhook(body, signature)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('RazorpayWebhookService.processWebhook — payment.failed', () => {
  it('marks a matching payment failed on first delivery', async () => {
    const { service, transactionMock } = buildHarness({
      existingPayments: { 'bk-1': { paymentId: 'bk-1', razorpayOrderId: 'order_1', status: 'created' } },
    });
    const body = Buffer.from(JSON.stringify(paymentFailedPayload('order_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'processed' });
    expect(transactionMock.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'failed' }));
  });

  it('never overwrites an already-captured payment — a late/out-of-order failed webhook is a no-op', async () => {
    const { service, transactionMock } = buildHarness({
      existingPayments: {
        'bk-1': { paymentId: 'bk-1', razorpayOrderId: 'order_1', status: 'captured', razorpayPaymentId: 'pay_1' },
      },
    });
    const body = Buffer.from(JSON.stringify(paymentFailedPayload('order_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'duplicate' });
    expect(transactionMock.update).not.toHaveBeenCalled();
  });

  it('is idempotent: a duplicate failed delivery applies no effect', async () => {
    const { service, transactionMock } = buildHarness({
      existingPayments: { 'bk-1': { paymentId: 'bk-1', razorpayOrderId: 'order_1', status: 'failed' } },
    });
    const body = Buffer.from(JSON.stringify(paymentFailedPayload('order_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'duplicate' });
    expect(transactionMock.update).not.toHaveBeenCalled();
  });
});

describe('RazorpayWebhookService.processWebhook — refund.processed', () => {
  it('marks a matching refund processed on first delivery', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingRefunds: { 'bk-1': { refundId: 'bk-1', razorpayRefundId: 'rfnd_1', status: 'processing' } },
    });
    const body = Buffer.from(JSON.stringify(refundProcessedPayload('rfnd_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'processed' });
    expect(transactionMock.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'processed' }));
    expect(auditLogService.recordInTransaction).toHaveBeenCalledWith(
      transactionMock,
      expect.objectContaining({ actorId: 'razorpay-webhook', actorRole: 'system', action: 'refund.processed' }),
    );
  });

  it('is idempotent: a duplicate delivery for an already-processed refund applies no effect', async () => {
    const { service, transactionMock, auditLogService } = buildHarness({
      existingRefunds: { 'bk-1': { refundId: 'bk-1', razorpayRefundId: 'rfnd_1', status: 'processed' } },
    });
    const body = Buffer.from(JSON.stringify(refundProcessedPayload('rfnd_1', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'duplicate' });
    expect(transactionMock.update).not.toHaveBeenCalled();
    expect(auditLogService.recordInTransaction).not.toHaveBeenCalled();
  });

  it('safely ignores a refund.processed event for an unrecognized refund', async () => {
    const { service, transactionMock } = buildHarness();
    const body = Buffer.from(JSON.stringify(refundProcessedPayload('rfnd_unknown', 'pay_1')));
    const signature = sign(body.toString('utf8'));

    const result = await service.processWebhook(body, signature);

    expect(result).toEqual({ status: 'ignored' });
    expect(transactionMock.update).not.toHaveBeenCalled();
  });

  it('rejects a malformed refund.processed payload missing the refund entity', async () => {
    const { service } = buildHarness();
    const body = Buffer.from(JSON.stringify({ event: 'refund.processed', payload: {} }));
    const signature = sign(body.toString('utf8'));
    await expect(service.processWebhook(body, signature)).rejects.toBeInstanceOf(BadRequestException);
  });
});
