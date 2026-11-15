import { describe,it,expect } from 'vitest';
import { originalTransportComponents } from '../../lib/visit-transport-return-review.js';
function snapshot(service:number,pickup:number,drop:number,rate=18,roundOffPaise=0){const subtotal=service+pickup+drop,tax=Math.round(subtotal*rate/100);return{subtotal,pickupFee:pickup,dropFee:drop,membershipDiscount:null,taxRatePercent:rate,tax,total:subtotal+tax+roundOffPaise,roundOffPaise};}
describe('original visit transport integer decomposition',()=>{
 it('uses the original tax marginal, not two independently rounded leg taxes',()=>{
  const pb=snapshot(1,1,1),copy={...pb},c=originalTransportComponents(pb);
  expect(c).toEqual({service:{basePaise:1,taxPaise:0,roundOffPaise:0,totalPaise:1},pickup:{basePaise:1,taxPaise:0,totalPaise:1},drop:{basePaise:1,taxPaise:1,totalPaise:2}});
  expect(pb).toEqual(copy);expect(c.pickup.taxPaise+c.drop.taxPaise).toBe(1);
 });
 it.each([-49,0,49])('preserves one original whole-invoice rounding adjustment %s without applying it to each leg',round=>{
  const pb=snapshot(10000,1001,2002,18,round),c=originalTransportComponents(pb);
  expect(c.service.roundOffPaise).toBe(round);expect(c.service.totalPaise+c.pickup.totalPaise+c.drop.totalPaise).toBe(pb.total);
  expect(c.pickup.basePaise).toBe(1001);expect(c.drop.basePaise).toBe(2002);
 });
 it('conserves every paise across tax rounding boundaries and asymmetric odd-fee legs',()=>{
  for(const rate of[0,5,12,18,28])for(let service=0;service<107;service++)for(const pickup of[0,1,2,17,51]){
   const pb=snapshot(service,pickup,19,rate),c=originalTransportComponents(pb);
   expect(c.service.taxPaise+c.pickup.taxPaise+c.drop.taxPaise).toBe(pb.tax);
   expect(c.service.totalPaise+c.pickup.totalPaise+c.drop.totalPaise).toBe(pb.total);
  }
 });
 it.each([{tax:1},{total:1},{subtotal:-1},{pickupFee:20000},{taxRatePercent:NaN},{roundOffPaise:51},{membershipDiscount:999999}])('rejects unverified original snapshot %j',patch=>{
  expect(()=>originalTransportComponents({...snapshot(10000,1000,1000),...patch})).toThrow();
 });
});
