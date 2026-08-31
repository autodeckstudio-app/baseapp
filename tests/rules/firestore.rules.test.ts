import { readFileSync } from 'fs';
import { join } from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-autodeck',
    firestore: {
      rules: readFileSync(join(__dirname, '../../firebase/firestore.rules'), 'utf8'),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

describe('Firestore security rules', () => {
  it('denies a Staff client from writing a booking directly', async () => {
    const staffDb = testEnv.authenticatedContext('staff-1', { role: 'staff' }).firestore();
    await assertFails(staffDb.collection('bookings').doc('b1').set({ customerId: 'cust-1' }));
  });

  it('denies an Owner/Admin client from writing a booking directly — backend-only, no role exception', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { role: 'owner_admin' }).firestore();
    await assertFails(adminDb.collection('bookings').doc('b1').set({ customerId: 'cust-1' }));
  });

  it("lets a customer read their own booking", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('bookings').doc('b1').set({ customerId: 'cust-1' });
    });
    const customerDb = testEnv.authenticatedContext('cust-1').firestore();
    await assertSucceeds(customerDb.collection('bookings').doc('b1').get());
  });

  it("denies a customer from reading another customer's booking", async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('bookings').doc('b1').set({ customerId: 'cust-1' });
    });
    const otherCustomerDb = testEnv.authenticatedContext('cust-2').firestore();
    await assertFails(otherCustomerDb.collection('bookings').doc('b1').get());
  });

  it('denies creating an audit log entry from any client role, including Owner/Admin', async () => {
    const adminDb = testEnv.authenticatedContext('admin-1', { role: 'owner_admin' }).firestore();
    await assertFails(adminDb.collection('auditLogs').add({ action: 'test' }));
  });

  it('denies updating or deleting an existing audit log entry, for every role', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('auditLogs').doc('a1').set({ action: 'booking.cancel' });
    });
    const adminDb = testEnv.authenticatedContext('admin-1', { role: 'owner_admin' }).firestore();
    await assertFails(adminDb.collection('auditLogs').doc('a1').update({ action: 'tampered' }));
    await assertFails(adminDb.collection('auditLogs').doc('a1').delete());
  });

  it('denies writing to a visit even when it is marked sealed — no client write path exists at all, for any role', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('visits').doc('v1').set({ customerId: 'cust-1', status: 'sealed' });
    });
    const staffDb = testEnv.authenticatedContext('staff-1', { role: 'staff' }).firestore();
    await assertFails(staffDb.collection('visits').doc('v1').update({ status: 'in_progress' }));
    const adminDb = testEnv.authenticatedContext('admin-1', { role: 'owner_admin' }).firestore();
    await assertFails(adminDb.collection('visits').doc('v1').update({ status: 'in_progress' }));
  });

  it('denies an unauthenticated client from reading anything', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('services').doc('svc-1').set({ name: 'Wash', basePrice: 500000 });
    });
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(anonDb.collection('services').doc('svc-1').get());
  });

  it('lets any signed-in user read the service catalogue', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().collection('services').doc('svc-1').set({ name: 'Wash', basePrice: 500000 });
    });
    const customerDb = testEnv.authenticatedContext('cust-1').firestore();
    await assertSucceeds(customerDb.collection('services').doc('svc-1').get());
  });
});
