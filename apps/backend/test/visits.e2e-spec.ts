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
 * bookings.e2e-spec.ts. Proves Phase 2F's visit lifecycle (check-in ->
 * complete -> seal) end-to-end, in particular that every transition is
 * gated by the existing `isValidBookingTransition` domain function and that
 * a sealed visit becomes permanently immutable.
 *
 * There is no "insufficient role -> 403" case here, same reasoning as
 * bookings.e2e-spec.ts: VisitsController is gated at `staff`, the lowest
 * tier, so there is no lower role to reject.
 */
describe('Visits management (e2e, emulator-backed)', () => {
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

    staffToken = await getTestIdToken(firebaseApp, 'e2e-visits-staff', 'staff');
    managerToken = await getTestIdToken(firebaseApp, 'e2e-visits-manager', 'studio_manager');

    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Visit Customer', phone: '+91-9000000040', email: 'visit-customer.e2e@example.com' })
      .expect(201);
    customerId = customerRes.body.customerId as string;

    const vehicleRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ make: 'Honda', model: 'City', plate: 'MH12VS0001' })
      .expect(201);
    vehicleId = vehicleRes.body.vehicleId as string;

    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Visit Test Service', basePrice: 500000 })
      .expect(201);
    serviceId = serviceRes.body.serviceId as string;
  }, 20000); // heavier setup than other e2e files' beforeAll (2 tokens + 3 seeded records)

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createFreshBooking(): Promise<string> {
    const res = await request(app.getHttpServer())
      .post(`/customers/${customerId}/bookings`)
      .set(authed(staffToken))
      .send({ vehicleId, serviceIds: [serviceId], scheduledAt: '2026-12-01T10:00:00.000Z' })
      .expect(201);
    return res.body.bookingId as string;
  }

  it('denies a request with no token at all', async () => {
    const bookingId = await createFreshBooking();
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/visits`).expect(401);
  });

  it('lets a Staff-tier user check in a booking, creating an in_progress visit', async () => {
    const bookingId = await createFreshBooking();
    const res = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);

    expect(res.body.visitId).toEqual(expect.any(String));
    expect(res.body.bookingId).toBe(bookingId);
    expect(res.body.customerId).toBe(customerId);
    expect(res.body.vehicleId).toBe(vehicleId);
    expect(res.body.status).toBe('in_progress');
  });

  it('returns 404 when checking in a nonexistent booking', async () => {
    await request(app.getHttpServer())
      .post('/bookings/does-not-exist/visits')
      .set(authed(staffToken))
      .expect(404);
  });

  it('rejects checking in the same booking twice — it is no longer in "booked" status after the first check-in', async () => {
    const bookingId = await createFreshBooking();
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/visits`).set(authed(staffToken)).expect(201);
    await request(app.getHttpServer()).post(`/bookings/${bookingId}/visits`).set(authed(staffToken)).expect(409);
  });

  it('lets a Staff-tier user complete a visit', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;

    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
  });

  it('returns 404 when completing a nonexistent visit', async () => {
    await request(app.getHttpServer())
      .patch('/visits/does-not-exist/complete')
      .set(authed(staffToken))
      .expect(404);
  });

  it('rejects completing the same visit twice — it is no longer in_progress after the first completion', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;

    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(409);
  });

  it('lets a Staff-tier user seal a completed visit', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;
    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);

    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(200);
  });

  it('returns 404 when sealing a nonexistent visit', async () => {
    await request(app.getHttpServer()).patch('/visits/does-not-exist/seal').set(authed(staffToken)).expect(404);
  });

  it('rejects sealing a visit that has not been completed yet', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;

    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(409);
  });

  it('rejects re-sealing an already-sealed visit — sealed visits are permanently immutable', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;
    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(200);

    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(409);
  });

  it('rejects completing an already-sealed visit — sealed visits are permanently immutable', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;
    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(200);

    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(409);
  });

  it('writes an append-only audit entry for check-in, completion, and sealing', async () => {
    const bookingId = await createFreshBooking();
    const visitRes = await request(app.getHttpServer())
      .post(`/bookings/${bookingId}/visits`)
      .set(authed(staffToken))
      .expect(201);
    const visitId = visitRes.body.visitId as string;
    await request(app.getHttpServer()).patch(`/visits/${visitId}/complete`).set(authed(staffToken)).expect(200);
    await request(app.getHttpServer()).patch(`/visits/${visitId}/seal`).set(authed(staffToken)).expect(200);

    const firestore = firebaseApp.firestore();
    const checkInEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', visitId)
      .where('action', '==', 'visit.check_in')
      .get();
    const completeEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', visitId)
      .where('action', '==', 'visit.complete')
      .get();
    const sealEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', visitId)
      .where('action', '==', 'visit.seal')
      .get();

    expect(checkInEntries.size).toBe(1);
    expect(completeEntries.size).toBe(1);
    expect(sealEntries.size).toBe(1);
  });
});
