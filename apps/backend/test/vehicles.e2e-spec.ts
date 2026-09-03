import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type * as admin from 'firebase-admin';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FIREBASE_ADMIN_APP } from '../src/auth/firebase-admin.provider';
import { getTestIdToken } from './utils/get-test-id-token';

/**
 * Runs against the local Firebase Emulator Suite only (via
 * `firebase emulators:exec`), same as staff.e2e-spec.ts. Proves Phase 2C's
 * vehicle-ownership guarantee end-to-end: `ownerCustomerId` always comes
 * from the URL's customer, never from anything a client puts in the body.
 */
describe('Vehicles management (e2e, emulator-backed)', () => {
  let app: INestApplication;
  let firebaseApp: admin.app.App;
  let staffToken: string;
  let customerId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    firebaseApp = moduleRef.get(FIREBASE_ADMIN_APP);

    staffToken = await getTestIdToken(firebaseApp, 'e2e-vehicles-staff', 'staff');

    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Vehicle Owner', phone: '+91-9000000020', email: 'vehicle-owner.e2e@example.com' })
      .expect(201);
    customerId = customerRes.body.customerId as string;
  });

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('lets a Staff-tier user create a vehicle under a customer', async () => {
    const res = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set(authed(staffToken))
      .send({ make: 'Honda', model: 'City', plate: 'MH12AB1234' })
      .expect(201);

    expect(res.body.ownerCustomerId).toBe(customerId);
  });

  it("ignores a client-supplied ownerCustomerId in the body — ownership always comes from the URL's customer", async () => {
    const res = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set(authed(staffToken))
      .send({ make: 'Toyota', model: 'Innova', plate: 'MH12CD5678', ownerCustomerId: 'attacker-controlled-id' })
      .expect(201);

    expect(res.body.ownerCustomerId).toBe(customerId);
    expect(res.body.ownerCustomerId).not.toBe('attacker-controlled-id');
  });

  it('returns 404 when creating a vehicle under a nonexistent customer', async () => {
    await request(app.getHttpServer())
      .post('/customers/does-not-exist/vehicles')
      .set(authed(staffToken))
      .send({ make: 'Honda', model: 'City', plate: 'MH12EF9012' })
      .expect(404);
  });

  it('denies a request with no token at all', async () => {
    await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .send({ make: 'Honda', model: 'City', plate: 'MH12GH3456' })
      .expect(401);
  });

  it('lets a Staff-tier user update a vehicle', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set(authed(staffToken))
      .send({ make: 'Honda', model: 'City', plate: 'MH12IJ7890' })
      .expect(201);
    const vehicleId = createRes.body.vehicleId as string;

    await request(app.getHttpServer())
      .patch(`/vehicles/${vehicleId}`)
      .set(authed(staffToken))
      .send({ plate: 'MH12ZZ0000' })
      .expect(200);
  });

  it('returns 404 when updating a nonexistent vehicle', async () => {
    await request(app.getHttpServer())
      .patch('/vehicles/does-not-exist')
      .set(authed(staffToken))
      .send({ plate: 'X' })
      .expect(404);
  });

  it('writes an append-only audit entry for vehicle creation', async () => {
    const createRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set(authed(staffToken))
      .send({ make: 'Audi', model: 'A4', plate: 'MH12KL1122' })
      .expect(201);
    const vehicleId = createRes.body.vehicleId as string;

    const firestore = firebaseApp.firestore();
    const entries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', vehicleId)
      .where('action', '==', 'vehicle.create')
      .get();

    expect(entries.size).toBe(1);
  });
});
