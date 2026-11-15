import {it,expect,vi} from 'vitest';
import type {Firestore} from 'firebase-admin/firestore';
import {refundsOwed} from '../../lib/refunds-owed.js';
function source(get:ReturnType<typeof vi.fn>){const q:any={where:vi.fn(),limit:vi.fn(),get};q.where.mockReturnValue(q);q.limit.mockReturnValue(q);return{db:{collection:vi.fn(()=>q)}as unknown as Firestore,q};}
it('an actual legacy owed query failure rejects, never zero, incomplete evidence or a partial report',async()=>{const error=new Error('fixture unavailable read'),s=source(vi.fn().mockRejectedValue(error));await expect(refundsOwed(s.db,'t','s')).rejects.toBe(error);expect(s.q.get).toHaveBeenCalledTimes(1);});
it('a successful empty legacy read is a known zero, unlike an unavailable read',async()=>{const s=source(vi.fn().mockResolvedValue({docs:[],size:0}));expect(await refundsOwed(s.db,'t','s')).toEqual({owedPaise:0,count:0,truncated:false});});
it('unusable legacy evidence returns finite incomplete totals, not a read failure or a fabricated full zero',async()=>{const rows=[{manualRefundDuePaise:3000},{manualRefundDuePaise:-1},{manualRefundDuePaise:'500'},{manualRefundDuePaise:Number.NaN},{}],s=source(vi.fn().mockResolvedValue({docs:rows.map(r=>({data:()=>r})),size:rows.length}));expect(await refundsOwed(s.db,'t','s')).toEqual({owedPaise:3000,count:1,truncated:true});});
