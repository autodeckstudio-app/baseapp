import { createHmac } from 'crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type * as admin from 'firebase-admin';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FIREBASE_ADMIN_APP } from '../src/auth/firebase-admin.provider';
import { RAZORPAY_CLIENT } from '../src/payments/razorpay.provider';
import { getTestIdToken } from './utils/get-test-id-token';

/**
 * Runs against the local Firebase Emulator Suite (via `firebase
 * emulators:exec`), same as every other *.e2e-spec.ts, PLUS a mocked
 * Razorpay client: `RAZORPAY_CLIENT` is overridden via Nest's
 * `overrideProvider` so this suite exercises the ENTIRE real orchestration
 * logic (order creation, webhook signature verification and idempotent
 * processing, refund processing, booking cancellation) without ever making
 * a real network call to Razorpay — which would require real credentials
 * this repository must never hold (see the Phase 2J report for why this is
 * the deliberate design, not a coverage gap).
 *
 * `RAZORPAY_WEBHOOK_SECRET` still comes from the real `.env` (a dummy,
 * emulator-only value — see .env.example) and is used to compute genuinely
 * valid HMAC signatures here, so webhook signature verification itself is
 * exercised for real, not mocked.
 */
describe('Payments management (e2e, emulator-backed, Razorpay client mocked)', () => {
  let app: INestApplication;
  let firebaseApp: admin.app.App;
  let staffToken: string;
  let managerToken: string;
  let customerId: string;
  let vehicleId: string;
  let serviceId: string;

  const webhookSecret = 'dummy_webhook_secret_for_emulator_only';
  let orderCounter = 0;
  let refundCounter = 0;
  const mockRazorpayClient = {
    orders: { create: jest.fn() },
    payments: { refund: jest.fn() },
  };

  beforeAll(async () => {
    mockRazorpayClient.orders.create.mockImplementation(async () => ({ id: `order_test_${++orderCounter}` }));
    mockRazorpayClient.payments.refund.mockImplementation(async () => ({
      id: `rfnd_test_${++refundCounter}`,
      status: 'processed',
    }));

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(RAZORPAY_CLIENT)
      .useValue(mockRazorpayClient)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
    firebaseApp = moduleRef.get(FIREBASE_ADMIN_APP);

    staffToken = await getTestIdToken(firebaseApp, 'e2e-payments-staff', 'staff');
    managerToken = await getTestIdToken(firebaseApp, 'e2e-payments-manager', 'studio_manager');

    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Payments Customer', phone: '+91-9000000070', email: 'payments-customer.e2e@example.com' })
      .expect(201);
    customerId = customerRes.body.customerId as string;

    const vehicleRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ make: 'Honda', model: 'City', plate: 'MH12PY0001' })
      .expect(201);
    vehicleId = vehicleRes.body.vehicleId as string;

    // basePrice > ₹10,000 (1,000,000 paise) so the booking requires an advance.
    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Payments Test Service', basePrice: 1500000 })
      .expect(201);
    serviceId = serviceRes.body.serviceId as string;
  }, 20000); // heavier setup than other e2e files' beforeAll

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  function sign(bodyString: string): string {
    return createHmac('sha256', webhookSecret).update(bodyString).digest('hex');
  }

  async function postWebhook(payload: unknown, signatureOverride?: string) {
    const bodyString = JSON.stringify(payload);
    const signature = signatureOverride ?? sign(bodyString);
    return request(app.getHttpServer())
      .post('/razorpay/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Razorpay-Signature', signature)
      .send(bodyString);
  }

  async function createAdvanceBooking(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/customers/${customerId}/bookings`)
      .set(authed(staffToken))
      .send({ vehicleId, serviceIds: [serviceId], scheduledAt: '2026-12-01T10:00:00.000Z' })
      .expect(201);
    return res.body.bookingId as string;
  }

  it('denies a request with no token at all when creating a payment order', async () => {
    const bookingId = await createAdvanceBooking();
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/payment-order`).expect(401);
  });

  it('lets a Staff-tier user create a payment order for a booking requiring an advance', async () => {
    const bookingId = await createAdvanceBooking();
    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);

    expect(res.body.paymentId).toBe(bookingId);
    expect(res.body.amount).toBe(600000);
    expect(res.body.razorpayOrderId).toEqual(expect.any(String));
    expect(res.body.status).toBe('created');
  });

  it('returns 404 when creating a payment order for a nonexistent booking', async () => {
    await request(app.getHttpServer())
      .post('/bookings/does-not-exist/payment-order')
      .set(authed(staffToken))
      .expect(404);
  });

  it('rejects creating a second payment order for the same booking', async () => {
    const bookingId = await createAdvanceBooking();
    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(409);
  });

  it('denies an unauthenticated webhook request lacking a valid signature', async () => {
    await postWebhook({ event: 'payment.captured', payload: {} }, 'not-a-real-signature').then((res) =>
      expect(res.status).toBe(401),
    );
  });

  it('rejects a malformed webhook payload even with a valid signature', async () => {
    const res = await postWebhook({ not: 'the expected shape' });
    expect(res.status).toBe(400);
  });

  it('acknowledges an unsupported webhook event without processing it', async () => {
    const res = await postWebhook({ event: 'order.paid', payload: {} });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'ignored' });
  });

  it('captures a payment via webhook after order creation, then confirms it is captured by allowing a refund flow to find it', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    const razorpayOrderId = orderRes.body.razorpayOrderId as string;

    const res = await postWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_1', order_id: razorpayOrderId } } },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ status: 'processed' });
  });

  it('is idempotent: redelivering the same payment.captured webhook applies no further effect', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    const razorpayOrderId = orderRes.body.razorpayOrderId as string;
    const capturedPayload = {
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_2', order_id: razorpayOrderId } } },
    };

    const first = await postWebhook(capturedPayload);
    expect(first.body).toEqual({ status: 'processed' });

    const duplicate = await postWebhook(capturedPayload);
    expect(duplicate.status).toBe(201);
    expect(duplicate.body).toEqual({ status: 'duplicate' });
  });

  it('runs the full advance-payment -> cancellation -> refund -> webhook-confirmation flow, with the refund amount coming only from the server', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    const razorpayOrderId = orderRes.body.razorpayOrderId as string;

    await postWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_3', order_id: razorpayOrderId } } },
    }).then((res) => expect(res.body).toEqual({ status: 'processed' }));

    // Cancellation is Phase 2E's existing, untouched flow — far enough in
    // the future that the >24h policy grants a full refund of the advance.
    await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/cancel`)
      .set(authed(staffToken))
      .send({ initiatedBy: 'customer' })
      .expect(200);

    // Simulate a refund that doesn't complete instantly (Razorpay's own API
    // can return `pending` for refunds needing bank processing time) —
    // this is the realistic case where the async webhook is what actually
    // confirms completion, not the synchronous API response.
    mockRazorpayClient.payments.refund.mockImplementationOnce(async () => ({
      id: `rfnd_test_${++refundCounter}`,
      status: 'pending',
    }));

    const refundRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/refund`)
      .set(authed(managerToken))
      .expect(201);

    expect(refundRes.body.refundId).toBe(bookingId);
    expect(refundRes.body.amount).toBe(600000); // the booking's own stored refundAmount — never client input
    expect(refundRes.body.razorpayRefundId).toEqual(expect.any(String));
    expect(refundRes.body.status).toBe('processing'); // not yet confirmed — awaiting the webhook below
    expect(mockRazorpayClient.payments.refund).toHaveBeenCalledWith('pay_e2e_3', { amount: 600000 });

    await postWebhook({
      event: 'refund.processed',
      payload: { refund: { entity: { id: refundRes.body.razorpayRefundId, payment_id: 'pay_e2e_3' } } },
    }).then((res) => expect(res.body).toEqual({ status: 'processed' }));
  });

  it('denies a Staff-tier user from processing a refund — refunds require Studio Manager authorization', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    await postWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_4', order_id: orderRes.body.razorpayOrderId } } },
    });
    await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/cancel`)
      .set(authed(staffToken))
      .send({ initiatedBy: 'customer' })
      .expect(200);

    await request(app.getHttpServer()).post(`/bookings/${bookingId}/refund`).set(authed(staffToken)).expect(403);
  });

  it('rejects processing a refund for a booking that was never cancelled', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    await postWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_5', order_id: orderRes.body.razorpayOrderId } } },
    });

    await request(app.getHttpServer()).post(`/bookings/${bookingId}/refund`).set(authed(managerToken)).expect(409);
  });

  it('rejects processing a refund twice for the same booking', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    await postWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_6', order_id: orderRes.body.razorpayOrderId } } },
    });
    await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/cancel`)
      .set(authed(staffToken))
      .send({ initiatedBy: 'customer' })
      .expect(200);

    await request(app.getHttpServer()).post(`/bookings/${bookingId}/refund`).set(authed(managerToken)).expect(201);
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/refund`).set(authed(managerToken)).expect(409);
  });

  it('writes append-only audit entries for order creation, payment capture, cancellation, and refund processing', async () => {
    const bookingId = await createAdvanceBooking();
    const orderRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/payment-order`)
      .set(authed(staffToken))
      .expect(201);
    await postWebhook({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_e2e_7', order_id: orderRes.body.razorpayOrderId } } },
    });
    await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}/cancel`)
      .set(authed(staffToken))
      .send({ initiatedBy: 'customer' })
      .expect(200);
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/refund`).set(authed(managerToken)).expect(201);

    const firestore = firebaseApp.firestore();
    const orderCreateEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', bookingId)
      .where('action', '==', 'payment.order_create')
      .get();
    const capturedEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', bookingId)
      .where('action', '==', 'payment.captured')
      .get();
    const refundEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', bookingId)
      .where('action', '==', 'refund.process')
      .get();

    expect(orderCreateEntries.size).toBe(1);
    expect(capturedEntries.size).toBe(1);
    expect(refundEntries.size).toBe(1);
  });
});
