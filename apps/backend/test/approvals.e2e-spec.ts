import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type * as admin from 'firebase-admin';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FIREBASE_ADMIN_APP } from '../src/auth/firebase-admin.provider';
import { getTestIdToken } from './utils/get-test-id-token';

/**
 * Runs against the local Firebase Emulator Suite only (via
 * `firebase emulators:exec`), same as staff/customers/vehicles/services/
 * bookings/visits.e2e-spec.ts. Proves Phase 2G's mid-visit approval flow
 * end-to-end: requesting an approval pauses the booking/visit
 * (`in_progress -> approval_required`), and resolving it — approved or
 * declined — always resumes them (`approval_required -> in_progress`),
 * per the existing, unmodified domain state machine.
 *
 * There is no "insufficient role -> 403" case here, same reasoning as
 * bookings/visits.e2e-spec.ts: ApprovalsController is gated at `staff`, the
 * lowest tier, so there is no lower role to reject.
 */
describe('Approvals management (e2e, emulator-backed)', () => {
  let app: INestApplication;
  let firebaseApp: admin.app.App;
  let staffToken: string;
  let managerToken: string;
  let customerId: string;
  let vehicleId: string;
  let serviceId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    firebaseApp = moduleRef.get(FIREBASE_ADMIN_APP);

    staffToken = await getTestIdToken(firebaseApp, 'e2e-approvals-staff', 'staff');
    managerToken = await getTestIdToken(firebaseApp, 'e2e-approvals-manager', 'studio_manager');

    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Approval Customer', phone: '+91-9000000050', email: 'approval-customer.e2e@example.com' })
      .expect(201);
    customerId = customerRes.body.customerId as string;

    const vehicleRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ make: 'Honda', model: 'City', plate: 'MH12AP0001' })
      .expect(201);
    vehicleId = vehicleRes.body.vehicleId as string;

    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Approval Test Service', basePrice: 500000 })
      .expect(201);
    serviceId = serviceRes.body.serviceId as string;
  }, 20000); // heavier setup than other e2e files' beforeAll (2 tokens + 3 seeded records)

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createInProgressVisit(): Promise<{ bookingId: string; visitId: string }> {
    const bookingRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/bookings`)
      .set(authed(staffToken))
      .send({ vehicleId, serviceIds: [serviceId], scheduledAt: '2026-12-01T10:00:00.000Z' })
      .expect(201);
    const bookingId = bookingRes.body.bookingId as string;

    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;

    return { bookingId, visitId };
  }

  it('denies a request with no token at all', async () => {
    const { visitId } = await createInProgressVisit();
    await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .send({ description: 'Extra work', additionalAmount: 10000 })
      .expect(401);
  });

  it('lets a Staff-tier user request an approval, pausing the visit and booking', async () => {
    const { bookingId, visitId } = await createInProgressVisit();
    const res = await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Found a damaged part, needs replacement', additionalAmount: 250000 })
      .expect(201);

    expect(res.body.approvalId).toEqual(expect.any(String));
    expect(res.body.bookingId).toBe(bookingId);
    expect(res.body.visitId).toBe(visitId);
    expect(res.body.customerId).toBe(customerId);
    expect(res.body.decision).toBe('pending');
  });

  it('returns 404 when requesting approval for a nonexistent visit', async () => {
    await request(app.getHttpServer())
      .post('/visits/does-not-exist/approvals')
      .set(authed(staffToken))
      .send({ description: 'Extra work', additionalAmount: 10000 })
      .expect(404);
  });

  it('rejects requesting a second approval while one is already pending — the booking is no longer in_progress', async () => {
    const { visitId } = await createInProgressVisit();
    await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'First request', additionalAmount: 10000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Second request', additionalAmount: 20000 })
      .expect(409);
  });

  it('lets a Staff-tier user resolve an approval as approved, resuming the visit/booking', async () => {
    const { visitId } = await createInProgressVisit();
    const approvalRes = await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Extra work', additionalAmount: 10000 })
      .expect(201);
    const approvalId = approvalRes.body.approvalId as string;

    await request(app.getHttpServer())
      .patch(`/approvals/${approvalId}/resolve`)
      .set(authed(staffToken))
      .send({ approved: true })
      .expect(200);
  });

  it('lets a Staff-tier user resolve an approval as declined — this still resumes the visit/booking, not cancels it', async () => {
    const { visitId } = await createInProgressVisit();
    const approvalRes = await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Extra work customer refuses', additionalAmount: 10000 })
      .expect(201);
    const approvalId = approvalRes.body.approvalId as string;

    await request(app.getHttpServer())
      .patch(`/approvals/${approvalId}/resolve`)
      .set(authed(staffToken))
      .send({ approved: false })
      .expect(200);

    // Completing the visit requires the booking to be exactly `in_progress`
    // (isValidBookingTransition rejects it from `cancelled`, `booked`, or
    // any other status) — succeeding here is the precise proof that a
    // decline resumed the workflow rather than leaving it stuck or
    // cancelling it.
    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
  });

  it('returns 404 when resolving a nonexistent approval', async () => {
    await request(app.getHttpServer())
      .patch('/approvals/does-not-exist/resolve')
      .set(authed(staffToken))
      .send({ approved: true })
      .expect(404);
  });

  it('rejects resolving the same approval twice — replay protection', async () => {
    const { visitId } = await createInProgressVisit();
    const approvalRes = await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Extra work', additionalAmount: 10000 })
      .expect(201);
    const approvalId = approvalRes.body.approvalId as string;

    await request(app.getHttpServer())
      .patch(`/approvals/${approvalId}/resolve`)
      .set(authed(staffToken))
      .send({ approved: true })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/approvals/${approvalId}/resolve`)
      .set(authed(staffToken))
      .send({ approved: true })
      .expect(409);
  });

  it('lets the resumed visit be completed and sealed normally after an approval is resolved', async () => {
    const { visitId } = await createInProgressVisit();
    const approvalRes = await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Extra work', additionalAmount: 10000 })
      .expect(201);
    const approvalId = approvalRes.body.approvalId as string;

    await request(app.getHttpServer())
      .patch(`/approvals/${approvalId}/resolve`)
      .set(authed(staffToken))
      .send({ approved: true })
      .expect(200);

    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(200);
  });

  it('writes an append-only audit entry for approval request and resolution', async () => {
    const { visitId } = await createInProgressVisit();
    const approvalRes = await request(app.getHttpServer())
      .post(`/visits/${visitId}/approvals`)
      .set(authed(staffToken))
      .send({ description: 'Audited approval', additionalAmount: 10000 })
      .expect(201);
    const approvalId = approvalRes.body.approvalId as string;

    await request(app.getHttpServer())
      .patch(`/approvals/${approvalId}/resolve`)
      .set(authed(staffToken))
      .send({ approved: true })
      .expect(200);

    const firestore = firebaseApp.firestore();
    const requestEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', approvalId)
      .where('action', '==', 'approval.request')
      .get();
    const resolveEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', approvalId)
      .where('action', '==', 'approval.resolve')
      .get();

    expect(requestEntries.size).toBe(1);
    expect(resolveEntries.size).toBe(1);
  });
});
