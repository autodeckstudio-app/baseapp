import { membershipCoveredLabel } from "@autodeck/core";
import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitingCancellation } from './waiting-cancel';
describe('studio waiting intent controls',()=>{
 for(const state of ['waiting','needs_review'])it(`hides controls for ${state}`,()=>expect(waitingCancellation({cancelIntent:{state}})).toBe(true));
 for(const state of ['resolved',undefined])it(`returns controls for ${state??'no intent'}`,()=>expect(waitingCancellation(state?{cancelIntent:{state}}:{})).toBe(false));
 it('routes both payment controls and requested labels through the same guard',()=>{const s=readFileSync(join(__dirname,'../app/(tabs)/jobs/[id].tsx'),'utf8');expect(s).toContain('const waitingCancel = waitingCancellation(booking)');expect(s).toContain('{!waitingCancel && !membershipCoveredLabel(job) && !(booking && membershipCoveredLabel(booking)) && !payment');expect(s).toContain('{!waitingCancel && payment &&');expect(s).toContain('waitingCancel ? "Cancellation requested"');});
 it("noncovered zero-total retains baseline payment offers; covered hides them",()=>{const s=readFileSync(join(__dirname,'../app/(tabs)/jobs/[id].tsx'),'utf8');const condition=s.match(/\{(!waitingCancel && !membershipCoveredLabel\(job\).*?) && \(/)![1]!;const visible=new Function('job','booking','waitingCancel','payment','membershipCoveredLabel',`return ${condition}`);const j={totalAmount:0,status:'PENDING_VEHICLE'};expect(visible(j,null,false,null,membershipCoveredLabel)).toBe(true);expect(visible({...j,membershipWashUsed:true},null,false,null,membershipCoveredLabel)).toBe(false);});
});
