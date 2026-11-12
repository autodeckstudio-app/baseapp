vi.mock('react-native',()=>({Platform:{OS:'web'}}));
import{it,expect,vi}from'vitest';import{combinedCheckoutReview,COMBINED_CHECKOUT_ENABLED}from'./combined-checkout';
const pb:any={subtotal:100000,pickupFee:0,dropFee:0,membershipDiscount:null,taxRatePercent:18,tax:18000,total:118000};
const transport={quoteId:'q',kind:'both' as const,lat:23,lng:72,address:'Sample address',legs:[{leg:'pickup' as const,feePaise:2500},{leg:'drop' as const,feePaise:5000}]};
it('scoped checkout active; both reviewed customer choices carry identical combined total',()=>{expect(COMBINED_CHECKOUT_ENABLED).toBe(true);expect(combinedCheckoutReview(pb,'advance20',transport).review).toMatchObject({version:3,paymentChoice:'advance20',expectedTotalPaise:126900,expectedPayNowPaise:25400});expect(combinedCheckoutReview(pb,'full',transport).review).toMatchObject({expectedTotalPaise:126900,expectedPayNowPaise:126900})});
it('missing or duplicate selected legs do not become a free charge',()=>{expect(()=>combinedCheckoutReview(pb,'full',{...transport,legs:[]})).toThrow();expect(()=>combinedCheckoutReview(pb,'full',{...transport,legs:[transport.legs[0]!,transport.legs[0]!]})).toThrow()});
