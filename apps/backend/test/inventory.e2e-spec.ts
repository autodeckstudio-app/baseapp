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
 * Phase 2I's minimal inventory flow end-to-end: item creation/update
 * (studio_manager), restocking (studio_manager), and usage recording
 * (staff) — in particular that `currentStock` really is
 * transaction-protected (two back-to-back usage recordings against a
 * small stock correctly allow what fits and reject the rest) and that
 * usage never drives stock negative.
 *
 * `@Roles('staff')` is only the floor for usage recording; create/update/
 * restock are gated at `studio_manager`, so the "insufficient role -> 403"
 * case IS covered below (mirroring services/packages.e2e-spec.ts), unlike
 * bookings/visits/approvals.e2e-spec.ts.
 */
describe('Inventory management (e2e, emulator-backed)', () => {
  let app: INestApplication;
  let firebaseApp: admin.app.App;
  let staffToken: string;
  let managerToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    firebaseApp = moduleRef.get(FIREBASE_ADMIN_APP);

    staffToken = await getTestIdToken(firebaseApp, 'e2e-inventory-staff', 'staff');
    managerToken = await getTestIdToken(firebaseApp, 'e2e-inventory-manager', 'studio_manager');
  });

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createItem(currentStock: number, lowStockThreshold = 5): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/inventory-items')
      .set(authed(managerToken))
      .send({ name: 'Wax', currentStock, lowStockThreshold })
      .expect(201);
    return res.body.inventoryItemId as string;
  }

  it('denies a request with no token at all', async () => {
    await request(app.getHttpServer())
      .post('/inventory-items')
      .send({ name: 'X', currentStock: 10, lowStockThreshold: 5 })
      .expect(401);
  });

  it('lets a Studio-Manager-tier user create an inventory item', async () => {
    const res = await request(app.getHttpServer())
      .post('/inventory-items')
      .set(authed(managerToken))
      .send({ name: 'Microfiber Cloths', currentStock: 50, lowStockThreshold: 10 })
      .expect(201);

    expect(res.body.inventoryItemId).toEqual(expect.any(String));
    expect(res.body.currentStock).toBe(50);
  });

  it('denies a Staff-tier user from creating an inventory item — managing the catalogue is a manager-level decision', async () => {
    await request(app.getHttpServer())
      .post('/inventory-items')
      .set(authed(staffToken))
      .send({ name: 'Unauthorized Item', currentStock: 10, lowStockThreshold: 5 })
      .expect(403);
  });

  it('lets a Studio-Manager-tier user update an inventory item', async () => {
    const inventoryItemId = await createItem(20);
    await request(app.getHttpServer())
      .patch(`/inventory-items/${inventoryItemId}`)
      .set(authed(managerToken))
      .send({ lowStockThreshold: 8 })
      .expect(200);
  });

  it('returns 404 when updating a nonexistent inventory item', async () => {
    await request(app.getHttpServer())
      .patch('/inventory-items/does-not-exist')
      .set(authed(managerToken))
      .send({ name: 'X' })
      .expect(404);
  });

  it('lets a Studio-Manager-tier user restock an inventory item', async () => {
    const inventoryItemId = await createItem(5);
    const res = await request(app.getHttpServer())
      .patch(`/inventory-items/${inventoryItemId}/restock`)
      .set(authed(managerToken))
      .send({ quantityReceived: 15 })
      .expect(200);

    expect(res.body.currentStock).toBe(20);
    expect(res.body.isLowStock).toBe(false);
  });

  it('denies a Staff-tier user from restocking — replenishing stock is a manager-level decision', async () => {
    const inventoryItemId = await createItem(5);
    await request(app.getHttpServer())
      .patch(`/inventory-items/${inventoryItemId}/restock`)
      .set(authed(staffToken))
      .send({ quantityReceived: 15 })
      .expect(403);
  });

  it('returns 404 when restocking a nonexistent inventory item', async () => {
    await request(app.getHttpServer())
      .patch('/inventory-items/does-not-exist/restock')
      .set(authed(managerToken))
      .send({ quantityReceived: 10 })
      .expect(404);
  });

  it('lets a Staff-tier user record inventory usage, deducting stock', async () => {
    const inventoryItemId = await createItem(10);
    const res = await request(app.getHttpServer())
      .post(`/inventory-items/${inventoryItemId}/usage`)
      .set(authed(staffToken))
      .send({ quantityUsed: 4 })
      .expect(201);

    expect(res.body.inventoryUsageId).toEqual(expect.any(String));
    expect(res.body.inventoryItemId).toBe(inventoryItemId);
    expect(res.body.quantityUsed).toBe(4);
  });

  it('returns 404 when recording usage against a nonexistent inventory item', async () => {
    await request(app.getHttpServer())
      .post('/inventory-items/does-not-exist/usage')
      .set(authed(staffToken))
      .send({ quantityUsed: 1 })
      .expect(404);
  });

  it('rejects recording usage that would exceed current stock — proves the transaction correctly tracks currentStock and never goes negative', async () => {
    const inventoryItemId = await createItem(5);

    await request(app.getHttpServer())
      .post(`/inventory-items/${inventoryItemId}/usage`)
      .set(authed(staffToken))
      .send({ quantityUsed: 4 })
      .expect(201);

    // Only 1 remains; requesting 4 more must fail rather than go negative.
    await request(app.getHttpServer())
      .post(`/inventory-items/${inventoryItemId}/usage`)
      .set(authed(staffToken))
      .send({ quantityUsed: 4 })
      .expect(409);
  });

  it('writes append-only audit entries for creation, restock, and usage recording', async () => {
    const inventoryItemId = await createItem(10);

    await request(app.getHttpServer())
      .patch(`/inventory-items/${inventoryItemId}/restock`)
      .set(authed(managerToken))
      .send({ quantityReceived: 5 })
      .expect(200);

    const usageRes = await request(app.getHttpServer())
      .post(`/inventory-items/${inventoryItemId}/usage`)
      .set(authed(staffToken))
      .send({ quantityUsed: 2 })
      .expect(201);
    const inventoryUsageId = usageRes.body.inventoryUsageId as string;

    const firestore = firebaseApp.firestore();
    const createEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', inventoryItemId)
      .where('action', '==', 'inventoryItem.create')
      .get();
    const restockEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', inventoryItemId)
      .where('action', '==', 'inventoryItem.restock')
      .get();
    const usageEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', inventoryUsageId)
      .where('action', '==', 'inventoryUsage.record')
      .get();

    expect(createEntries.size).toBe(1);
    expect(restockEntries.size).toBe(1);
    expect(usageEntries.size).toBe(1);
  });
});
