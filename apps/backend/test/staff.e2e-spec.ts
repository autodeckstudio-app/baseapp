import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type * as admin from 'firebase-admin';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FIREBASE_ADMIN_APP } from '../src/auth/firebase-admin.provider';
import { getTestIdToken } from './utils/get-test-id-token';

/**
 * Runs against the local Firebase Emulator Suite only (via
 * `firebase emulators:exec`). Proves Phase 2B's security requirements
 * end-to-end: real Firebase Auth accounts, real custom claims, real
 * Firestore writes, real session revocation — not mocks.
 */
describe('Staff management (e2e, emulator-backed)', () => {
  let app: INestApplication;
  let firebaseApp: admin.app.App;
  let ownerToken: string;
  let managerToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    firebaseApp = moduleRef.get(FIREBASE_ADMIN_APP);

    ownerToken = await getTestIdToken(firebaseApp, 'e2e-staff-owner', 'owner_admin');
    managerToken = await getTestIdToken(firebaseApp, 'e2e-staff-manager', 'studio_manager');
  });

  afterAll(async () => {
    await app.close();
  });

  function authed(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('lets a Studio Manager create a Staff-tier account', async () => {
    const res = await request(app.getHttpServer())
      .post('/staff')
      .set(authed(managerToken))
      .send({
        name: 'Rahul',
        phone: '+91-9000000001',
        email: 'rahul.e2e@example.com',
        jobTitle: 'Technician',
        role: 'staff',
      })
      .expect(201);

    expect(res.body.permissionRole).toBe('staff');
    expect(res.body.staffId).toEqual(expect.any(String));
  });

  it('denies a Studio Manager from creating a Studio-Manager-tier account', async () => {
    await request(app.getHttpServer())
      .post('/staff')
      .set(authed(managerToken))
      .send({
        name: 'Peer Manager',
        phone: '+91-9000000002',
        email: 'peer-manager.e2e@example.com',
        jobTitle: 'Manager',
        role: 'studio_manager',
      })
      .expect(403);
  });

  it('lets an Owner/Admin create a Studio-Manager-tier account', async () => {
    await request(app.getHttpServer())
      .post('/staff')
      .set(authed(ownerToken))
      .send({
        name: 'New Manager',
        phone: '+91-9000000003',
        email: 'new-manager.e2e@example.com',
        jobTitle: 'Manager',
        role: 'studio_manager',
      })
      .expect(201);
  });

  it('denies a request with no token at all', async () => {
    await request(app.getHttpServer())
      .post('/staff')
      .send({ name: 'X', phone: '1', email: 'x@example.com', jobTitle: 'X', role: 'staff' })
      .expect(401);
  });

  it("jobTitle never affects authorization — a misleading jobTitle of 'Owner' on a staff-role account grants nothing extra", async () => {
    const createRes = await request(app.getHttpServer())
      .post('/staff')
      .set(authed(ownerToken))
      .send({
        name: 'Misleading Title',
        phone: '+91-9000000004',
        email: 'misleading.e2e@example.com',
        jobTitle: 'Owner', // deliberately misleading — must have zero effect
        role: 'staff',
      })
      .expect(201);

    const staffId = createRes.body.staffId as string;
    const misleadingToken = await getTestIdToken(firebaseApp, staffId, 'staff');

    // Still only 'staff' by role — a studio_manager-gated endpoint must
    // reject them regardless of the jobTitle string.
    await request(app.getHttpServer())
      .get('/health/secure')
      .set(authed(misleadingToken))
      .expect(403);
  });

  it('denies self-deactivation', async () => {
    await request(app.getHttpServer())
      .patch('/staff/e2e-staff-owner/deactivate')
      .set(authed(ownerToken))
      .expect(403);
  });

  it('denies self-role-change', async () => {
    await request(app.getHttpServer())
      .patch('/staff/e2e-staff-owner/role')
      .set(authed(ownerToken))
      .send({ role: 'studio_manager' })
      .expect(403);
  });

  it('denies a Studio Manager from deactivating a Studio-Manager-tier target', async () => {
    // Created through the real endpoint (as Owner/Admin) so an actual
    // `staff` Firestore record exists — using getTestIdToken alone would
    // only create the Auth account, not the record this check reads.
    const createRes = await request(app.getHttpServer())
      .post('/staff')
      .set(authed(ownerToken))
      .send({
        name: 'Peer Manager Target',
        phone: '+91-9000000007',
        email: 'peer-manager-target.e2e@example.com',
        jobTitle: 'Manager',
        role: 'studio_manager',
      })
      .expect(201);
    const peerManagerId = createRes.body.staffId as string;

    await request(app.getHttpServer())
      .patch(`/staff/${peerManagerId}/deactivate`)
      .set(authed(managerToken))
      .expect(403);
  });

  it(
    'deactivation revokes the session end-to-end: the same token that gets 403 (valid but ' +
      'insufficient role) before deactivation gets 401 (revoked) after it',
    async () => {
      const createRes = await request(app.getHttpServer())
        .post('/staff')
        .set(authed(ownerToken))
        .send({
          name: 'To Be Deactivated',
          phone: '+91-9000000005',
          email: 'deactivate-me.e2e@example.com',
          jobTitle: 'Technician',
          role: 'staff',
        })
        .expect(201);

      const staffId = createRes.body.staffId as string;
      const staffToken = await getTestIdToken(firebaseApp, staffId, 'staff');

      // Before deactivation: token is valid, role is just insufficient.
      await request(app.getHttpServer()).get('/health/secure').set(authed(staffToken)).expect(403);

      await request(app.getHttpServer())
        .patch(`/staff/${staffId}/deactivate`)
        .set(authed(ownerToken))
        .expect(200);

      // After deactivation: the SAME token now fails verification itself.
      await request(app.getHttpServer()).get('/health/secure').set(authed(staffToken)).expect(401);
    },
  );

  it('writes an append-only audit entry for staff creation and deactivation', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/staff')
      .set(authed(ownerToken))
      .send({
        name: 'Audited Person',
        phone: '+91-9000000006',
        email: 'audited.e2e@example.com',
        jobTitle: 'Technician',
        role: 'staff',
      })
      .expect(201);
    const staffId = createRes.body.staffId as string;

    await request(app.getHttpServer()).patch(`/staff/${staffId}/deactivate`).set(authed(ownerToken)).expect(200);

    const firestore = firebaseApp.firestore();
    const createEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', staffId)
      .where('action', '==', 'staff.create')
      .get();
    const deactivateEntries = await firestore
      .collection('auditLogs')
      .where('entityId', '==', staffId)
      .where('action', '==', 'staff.deactivate')
      .get();

    expect(createEntries.size).toBe(1);
    expect(deactivateEntries.size).toBe(1);
  });
});
