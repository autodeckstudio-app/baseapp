import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type * as admin from 'firebase-admin';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { FIREBASE_ADMIN_APP } from '../src/auth/firebase-admin.provider';
import { getTestIdToken } from './utils/get-test-id-token';

/**
 * Runs against the local Firebase Emulator Suite only (via
 * `firebase emulators:exec`). Proves the auth/RBAC chain — token
 * verification, custom claims, RolesGuard — works end-to-end, not just at
 * the unit level.
 */
describe('Health (e2e, emulator-backed)', () => {
  let app: INestApplication;
  let firebaseApp: admin.app.App;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    firebaseApp = moduleRef.get(FIREBASE_ADMIN_APP);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health is public and requires no token', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('GET /health/secure rejects a request with no token', async () => {
    await request(app.getHttpServer()).get('/health/secure').expect(401);
  });

  it('GET /health/secure rejects a valid token with an insufficient role', async () => {
    const token = await getTestIdToken(firebaseApp, 'e2e-staff-user', 'staff');
    await request(app.getHttpServer())
      .get('/health/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('GET /health/secure succeeds for a valid token with a sufficient role', async () => {
    const token = await getTestIdToken(firebaseApp, 'e2e-manager-user', 'studio_manager');
    await request(app.getHttpServer())
      .get('/health/secure')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
