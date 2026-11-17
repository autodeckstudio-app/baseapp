import {it,expect} from 'vitest';
import {cancellationTerms,combinedCancellationTerms,visitCancellationFee,type SharedVisit,type VisitMember} from '@autodeck/core';
import {readFileSync} from 'node:fs';
it('legacy base is the cancelled service total; combined base excludes transport and its GST',()=>{
 const nowMs=Date.parse('2026-11-17T10:00:00Z'),i={categories:['ceramic'],scheduledAtMs:nowMs+23*3600000,nowMs};
 expect(cancellationTerms({...i,totalPaise:106200}).feePaise).toBe(21240);
 expect(combinedCancellationTerms({subtotal:107500,pickupFee:2500,dropFee:5000,membershipDiscount:10000,taxRatePercent:18},i)).toMatchObject({feePaise:21240,serviceTotalPaise:106200});
 // Whole transport-inclusive total would wrongly yield23010, not21240.
 expect(cancellationTerms({...i,totalPaise:115050}).feePaise).toBe(23010);
});
it('another continuing service waives fee without redistributing or recomputing the target policy base',()=>{
 const visit={id:'v',tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',revision:1,jobIds:['a','b']} as SharedVisit;
 const m=(id:string,status='PENDING_VEHICLE')=>({id,tenantId:'t',studioId:'s',customerId:'c',vehicleId:'car',visitId:'v',status}) as VisitMember;
 expect(visitCancellationFee(visit,[m('a'),m('b')],'a',21240).feePaise).toBe(0);
 expect(visitCancellationFee(visit,[m('a'),m('b','CANCELLED')],'a',21240).feePaise).toBe(21240);
});
it('read and cancel adapters use target stored total, not aggregated visit total',()=>{
 for(const p of ['functions/src/functions/visit/getVisitBill.ts','functions/src/functions/visit/cancelVisitService.ts']){
 const s=readFileSync(new URL('../../../../'+p,import.meta.url),'utf8');expect(s).toContain('totalPaise:target.job.totalAmount');expect(s).toContain('combinedCancellationTerms(target.job.priceBreakdown');expect(s).toContain('visitCancellationFee(');
 }
});
