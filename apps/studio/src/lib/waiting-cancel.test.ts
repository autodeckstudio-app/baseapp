import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { waitingCancellation } from './waiting-cancel';
describe('studio waiting intent controls',()=>{
 for(const state of ['waiting','needs_review'])it(`hides controls for ${state}`,()=>expect(waitingCancellation({cancelIntent:{state}})).toBe(true));
 for(const state of ['resolved',undefined])it(`returns controls for ${state??'no intent'}`,()=>expect(waitingCancellation(state?{cancelIntent:{state}}:{})).toBe(false));
 it('routes both payment controls and requested labels through the same guard',()=>{const s=readFileSync(join(__dirname,'../app/(tabs)/jobs/[id].tsx'),'utf8');expect(s).toContain('const waitingCancel = waitingCancellation(booking)');expect(s).toContain('{!waitingCancel && !payment');expect(s).toContain('{!waitingCancel && payment &&');expect(s).toContain('waitingCancel ? "Cancellation requested"');});
});
