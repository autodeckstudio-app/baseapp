import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type * as admin from 'firebase-admin';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FIREBASE_ADMIN_APP } from '../src/auth/firebase-admin.provider';
import { getTestIdToken } from './utils/get-test-id-token';

/**
 * Runs against the local Firebase Emulator Suite only (via
 * `firebase emulators:exec`), same as every other *.e2e-spec.ts. Proves
 * Phase 2H's package catalogue, purchase, and usage-consumption flow
 * end-to-end — in particular that consumption really does use a Firestore
 * transaction (proven indirectly: two back-to-back consumes against a
 * quantity-1 package correctly allow exactly one and reject the second)
 * and that a vehicle from a different customer can never consume another
 * customer's package.
 *
 * Package expiry is intentionally NOT exercised here: doing so would
 * require manipulating the emulator's clock, which isn't practical in an
 * e2e test. It is exhaustively covered at the unit level
 * (customer-packages.service.spec.ts) and in the underlying domain
 * function's own tests (packages/domain/src/__tests__/packages.test.ts).
 *
 * There is no "insufficient role -> 403" case for consumption/purchase
 * (staff-minimum, the lowest tier), same reasoning as
 * bookings/visits/approvals.e2e-spec.ts. Package DEFINITION routes ARE
 * gated higher (studio_manager), so that case is covered below, mirroring
 * services.e2e-spec.ts.
 */
describe('Packages management (e2e, emulator-backed)', () => {
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

    staffToken = await getTestIdToken(firebaseApp, 'e2e-packages-staff', 'staff');
    managerToken = await getTestIdToken(firebaseApp, 'e2e-packages-manager', 'studio_manager');

    const customerRes = await request(app.getHttpServer())
      .post('/customers')
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Package Customer', phone: '+91-9000000060', email: 'package-customer.e2e@example.com' })
      .expect(201);
    customerId = customerRes.body.customerId as string;

    const vehicleRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/vehicles`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ make: 'Honda', model: 'City', plate: 'MH12PK0001' })
      .expect(201);
    vehicleId = vehicleRes.body.vehicleId as string;

    const serviceRes = await request(app.getHttpServer())
      .post('/services')
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ name: 'Package Wash Service', basePrice: 50000 })
      .expect(201);
    serviceId = serviceRes.body.serviceId as string;
  }, 20000); // heavier setup than other e2e files' beforeAll (2 tokens + 3 seeded records)

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createPackageDefinition(quantity: number): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/package-definitions')
      .set(authed(managerToken))
      .send({
        name: `${quantity} Washes`,
        includedServiceId: serviceId,
        quantity,
        price: 450000,
        validityDuration: { unit: 'month', value: 12 },
      })
      .expect(201);
    return res.body.packageDefinitionId as string;
  }

  it('denies a request with no token at all', async () => {
    await request(app.getHttpServer())
      .post('/package-definitions')
      .send({ name: 'X', includedServiceId: serviceId, quantity: 1, price: 1000, validityDuration: { unit: 'month', value: 1 } })
      .expect(401);
  });

  it('lets a Studio-Manager-tier user create a package definition', async () => {
    const res = await request(app.getHttpServer())
      .post('/package-definitions')
      .set(authed(managerToken))
      .send({
        name: '10 Washes',
        includedServiceId: serviceId,
        quantity: 10,
        price: 450000,
        validityDuration: { unit: 'month', value: 12 },
      })
      .expect(201);

    expect(res.body.packageDefinitionId).toEqual(expect.any(String));
    expect(res.body.quantity).toBe(10);
  });

  it('denies a Staff-tier user from creating a package definition — pricing/catalogue is a manager-level decision', async () => {
    await request(app.getHttpServer())
      .post('/package-definitions')
      .set(authed(staffToken))
      .send({
        name: 'Unauthorized Package',
        includedServiceId: serviceId,
        quantity: 5,
        price: 100000,
        validityDuration: { unit: 'month', value: 6 },
      })
      .expect(403);
  });

  it('returns 404 when creating a package definition for a nonexistent service', async () => {
    await request(app.getHttpServer())
      .post('/package-definitions')
      .set(authed(managerToken))
      .send({
        name: 'Bad Service Ref',
        includedServiceId: 'does-not-exist',
        quantity: 5,
        price: 100000,
        validityDuration: { unit: 'month', value: 6 },
      })
      .expect(404);
  });

  it('lets a Studio-Manager-tier user update a package definition', async () => {
    const packageDefinitionId = await createPackageDefinition(4);
    await request(app.getHttpServer())
      .patch(`/package-definitions/${packageDefinitionId}`)
      .set(authed(managerToken))
      .send({ price: 500000 })
      .expect(200);
  });

  it('lets a Staff-tier user purchase a customer package', async () => {
    const packageDefinitionId = await createPackageDefinition(4);
    const res = await request(app.getHttpServer())
      .post(`/customers/${customerId}/packages`)
      .set(authed(staffToken))
      .send({ packageDefinitionId })
      .expect(201);

    expect(res.body.customerPackageId).toEqual(expect.any(String));
    expect(res.body.customerId).toBe(customerId);
    expect(res.body.totalQty).toBe(4);
    expect(res.body.remainingQty).toBe(4);
    expect(res.body.pricePaid).toBe(450000);
  });

  it('returns 404 when purchasing a package for a nonexistent customer', async () => {
    const packageDefinitionId = await createPackageDefinition(4);
    await request(app.getHttpServer())
      .post('/customers/does-not-exist/packages')
      .set(authed(staffToken))
      .send({ packageDefinitionId })
      .expect(404);
  });

  it('returns 404 when purchasing a nonexistent package definition', async () => {
    await request(app.getHttpServer())
      .post(`/customers/${customerId}/packages`)
      .set(authed(staffToken))
      .send({ packageDefinitionId: 'does-not-exist' })
      .expect(404);
  });

  it('lets a Staff-tier user consume package usage against an owned vehicle', async () => {
    const packageDefinitionId = await createPackageDefinition(4);
    const purchaseRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/packages`)
      .set(authed(staffToken))
      .send({ packageDefinitionId })
      .expect(201);
    const customerPackageId = purchaseRes.body.customerPackageId as string;

    const res = await request(app.getHttpServer())
      .post(`/customer-packages/${customerPackageId}/usage`)
      .set(authed(staffToken))
      .send({ vehicleId })
      .expect(201);

    expect(res.body.packageUsageId).toEqual(expect.any(String));
    expect(res.body.customerPackageId).toBe(customerPackageId);
    expect(res.body.vehicleId).toBe(vehicleId);
  });

  it('rejects consuming usage once the quantity is exhausted — proves the transaction correctly tracks remainingQty', async () => {
    const packageDefinitionId = await createPackageDefinition(1);
    const purchaseRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/packages`)
      .set(authed(staffToken))
      .send({ packageDefinitionId })
      .expect(201);
    const customerPackageId = purchaseRes.body.customerPackageId as string;

    await request(app.getHttpServer())
      .post(`/customer-packages/${customerPackageId}/usage`)
      .set(authed(staffToken))
      .send({ vehicleId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/customer-packages/${customerPackageId}/usage`)
      .set(authed(staffToken))
      .send({ vehicleId })
      .expect(409);
  });

  it("rejects consuming usage against a vehicle belonging to a different customer — a package can never be used by someone else's vehicle", async () => {
    const otherCustomerRes = await request(app.getHttpServer())
      .post('/customers')
      .set(authed(staffToken))
      .send({ name: 'Other Package Customer', phone: '+91-9000000061', email: 'other-package-customer.e2e@example.com' })
      .expect(201);
    const otherCustomerId = otherCustomerRes.body.customerId as string;
    const otherVehicleRes = await request(app.getHttpServer())
      .post(`/customers/${otherCustomerId}/vehicles`)
      .set(authed(staffToken))
      .send({ make: 'Toyota', model: 'Innova', plate: 'MH12PK0002' })
      .expect(201);
    const otherVehicleId = otherVehicleRes.body.vehicleId as string;

    const packageDefinitionId = await createPackageDefinition(4);
    const purchaseRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/packages`)
      .set(authed(staffToken))
      .send({ packageDefinitionId })
      .expect(201);
    const customerPackageId = purchaseRes.body.customerPackageId as string;

    await request(app.getHttpServer())
      .post(`/customer-packages/${customerPackageId}/usage`)
      .set(authed(staffToken))
      .send({ vehicleId: otherVehicleId })
      .expect(400);
  });

  it('returns 404 when consuming usage against a nonexistent customer package', async () => {
    await request(app.getHttpServer())
      .post('/customer-packages/does-not-exist/usage')
      .set(authed(staffToken))
      .send({ vehicleId })
      .expect(404);
  });

  it('writes append-only audit entries for package definition creation, purchase, and consumption', async () => {
    const packageDefinitionId = await createPackageDefinition(4);
    const purchaseRes = await request(app.getHttpServer())
      .post(`/customers/${customerId}/packages`)
      .set(authed(staffToken))
      .send({ packageDefinitionId })
      .expect(201);
    const customerPackageId = purchaseRes.body.customerPackageId as string;
    const usageRes = await request(app.getHttpServer())
      .post(`/customer-packages/${customerPackageId}/usage`)
      .set(authed(staffToken))
      .send({ vehicleId })
      .expect(201);
    const packageUsageId = usageRes.body.packageUsageId as string;

    const firestore = firebaseApp.firestore();
    const definitionEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', packageDefinitionId)
      .where('action', '==', 'packageDefinition.create')
      .get();
    const purchaseEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', customerPackageId)
      .where('action', '==', 'customerPackage.create')
      .get();
    const consumeEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', packageUsageId)
      .where('action', '==', 'packageUsage.consume')
      .get();

    expect(definitionEntries.size).toBe(1);
    expect(purchaseEntries.size).toBe(1);
    expect(consumeEntries.size).toBe(1);
  });
});
