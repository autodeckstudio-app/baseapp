import { describe, it, expect, vi } from "vitest";
vi.mock('./firebase',()=>({db:{},functions:{}}));
vi.mock('firebase/functions',()=>({httpsCallable:vi.fn()}));
import { customerBookingState } from './booking-service';
import fixture from './waiting-runtime-fixture.json';
describe('waiting real callable fixture customer status',()=>{
 it('never derives CANCELLED after studio close before a verified terminal event',()=>{
  vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-30T21:00:00+05:30'));
  for(const state of ['waiting','needs_review'])expect(customerBookingState({...fixture,cancelIntent:{...fixture.cancelIntent,state}} as never).status).toBe('PENDING');
  expect(customerBookingState({...fixture,cancelIntent:undefined} as never).status).toBe('CANCELLED');
  vi.useRealTimers();
 });
});
