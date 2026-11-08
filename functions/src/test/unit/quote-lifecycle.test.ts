import { describe,it,expect } from 'vitest';
import { assertQuoteOfferCurrent, QUOTE_VALID_MS } from '../../lib/quote-lifecycle.js';
const now=Date.parse('2026-11-04T18:00:00Z');
const offer={status:'ACTIVE',quoteStatus:'quoted',totalAmount:10000,updatedAt:'v1',quoteExpiresAt:new Date(now+QUOTE_VALID_MS).toISOString()};
describe('seven day exact quote offer',()=>{
 it('allows only the exact current offer before expiry',()=>expect(()=>assertQuoteOfferCurrent(offer,10000,'v1',now)).not.toThrow());
 it.each([{quoteExpiresAt:undefined},{quoteExpiresAt:'bad'},{quoteExpiresAt:new Date(now).toISOString()},{status:'CANCELLED'},{quoteStatus:'declined'},{quoteStatus:'approved'}])('holds expired, legacy and closed offers %j',patch=>expect(()=>assertQuoteOfferCurrent({...offer,...patch},10000,'v1',now)).toThrow());
 it('holds old price or version even when total unchanged',()=>{expect(()=>assertQuoteOfferCurrent(offer,9999,'v1',now)).toThrow();expect(()=>assertQuoteOfferCurrent(offer,10000,'v0',now)).toThrow()});
});
