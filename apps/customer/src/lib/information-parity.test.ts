import {it,expect} from 'vitest';
import {membershipOnlinePayCopy,type OnlinePayOutcome} from './native-pay-core';
it('membership status facts preserve each payment outcome and entitlement warning',()=>{
 for(const outcome of [null,'paid','pending','failed','refunded','partially_refunded','dismissed'] as (OnlinePayOutcome|null)[])
 for(const active of [null,'silver']){
  const c=membershipOnlinePayCopy(outcome,active);
  // Question punctuation is a label now; every payment/entitlement sentence remains.
  const text=c.facts.map(f=>f.text).join(' ');
  expect(text).toBe(c.body.replace('Closed the payment window? ',''));
 }
});
