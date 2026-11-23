import React from 'react';
import { act, create } from 'react-test-renderer';
import { it, expect, vi } from 'vitest';
const h = vi.hoisted(() => ({ snapshot: null as any, restored: false, sends: [] as any[], tenant: "t", callbacks: [] as any[] }));
vi.mock('../../../lib/firebase', () => ({ db: {}, functions: {} }));
vi.mock('../../../lib/auth-context', () => ({ useAdminAuth: () => ({ claims: { tenantId: h.tenant, role: "admin" } }) }));
vi.mock('../../../lib/use-labels', () => ({ useLabels: () => ({ c: 'Synthetic member' }) }));
vi.mock('../../../lib/gift-verification-service', () => ({ verifyEnteredGift: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (...a: any[]) => a, query: (...a: any[]) => a, where: (...a: any[]) => a, doc: (...a: any[]) => a,
  getDocs: vi.fn(), getDoc: vi.fn(),
  onSnapshot: (_q: any, cb: any) => { h.snapshot = cb; h.callbacks.push(cb); return () => {}; },
}));
const member = (used: number) => ({ id: 'm', tenantId: 't', customerId: 'c', planId: 'p', tier: 'platinum', status: 'active', endDate: '2099-01-01', washesUsed: 0, washesTotal: 8, refreshesTotal: 1, refreshesUsed: used });
vi.mock('firebase/functions', () => ({ httpsCallable: (_f: any, name: string) => async (args: any) => {
  if (name === 'getMembershipPlans') return { data: { plans: [] } };
  if (name === 'getMembershipUsage') return { data: { usage: [], refreshUsage: [{ id: 'r', jobId: 'j', usedAt: '2026-11-19', restoredAt: null }] } };
  if (name === 'restoreMembershipRefresh') { h.sends.push(args); h.restored = true; h.snapshot({ docs: [{ data: () => member(0) }] }); return { data: { refreshesUsed: 0, refreshesTotal: 1 } }; }
  return { data: {} };
} }));
import Page, { RefreshUsagePanel } from './page';
it('actual page listener, service adapter and restore action update displayed balance only from fresh snapshot', async () => {
  vi.stubGlobal('window', { prompt: () => 'Synthetic duplicate record correction' });
  let r: any; await act(async () => { r = create(<Page />); });
  await act(async () => h.snapshot({ docs: [{ data: () => member(1) }] }));
  const text = () => JSON.stringify(r.toJSON());
  const review = () => r.root.findAllByType('button').find((b: any) => JSON.stringify(b.props.children).includes('review'));
  expect(JSON.stringify(review().props.children)).toContain('1');
  await act(async () => review().props.onClick());
  const restore = r.root.findAllByType('button').find((b: any) => b.props.children === 'Restore credit');
  expect(restore).toBeTruthy();
  await act(async () => restore.props.onClick());
  expect(h.sends).toEqual([{ membershipId: 'm', refreshUsageId: 'r', reason: 'Synthetic duplicate record correction' }]);
  expect(text()).toContain('Refresh credit restored.');
  const balance = r.root.findAllByType('button').find((b: any) => JSON.stringify(b.props.children).includes('hide'));
  expect(balance.props.children).toEqual([0, ' of ', 1, ' - hide']);
  await act(async () => r.unmount()); vi.unstubAllGlobals();
});

it('actual restore panel rejects retained callbacks after membership roundtrip and unmount', async () => {
  h.sends = []; vi.stubGlobal('window', { prompt: () => 'Synthetic correction' });
  let r: any; await act(async () => { r = create(<RefreshUsagePanel membershipId="m" />); });
  const old = r.root.findAllByType('button').find((b: any) => b.props.children === 'Restore credit').props.onClick;
  await act(async () => r.update(<RefreshUsagePanel membershipId="other" />));
  await act(async () => r.update(<RefreshUsagePanel membershipId="m" />));
  await act(async () => old()); expect(h.sends).toHaveLength(0);
  const fresh = r.root.findAllByType('button').find((b: any) => b.props.children === 'Restore credit').props.onClick;
  await act(async () => r.unmount()); await act(async () => fresh());
  expect(h.sends).toHaveLength(0); vi.unstubAllGlobals();
});
it('actual page clears former tenant rows and ignores old listener callbacks after switching tenant', async () => {
  h.tenant = 't'; let r: any; await act(async () => { r = create(<Page />); });
  const old = h.snapshot;
  await act(async () => old({ docs: [{ data: () => member(1) }] }));
  h.tenant = 'new'; await act(async () => r.update(<Page />));
  await act(async () => old({ docs: [{ data: () => ({ ...member(1), customerId: 'PRIVATE-OLD' }) }] }));
  expect(JSON.stringify(r.toJSON())).not.toContain('PRIVATE-OLD');
  await act(async () => h.snapshot({ docs: [{ data: () => ({ ...member(0), tenantId: 'new' }) }] }));
  expect(JSON.stringify(r.toJSON())).toContain('Synthetic member');
  await act(async () => r.unmount()); h.tenant = 't';
});
