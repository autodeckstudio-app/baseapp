import{it,expect,vi}from'vitest';
const h=vi.hoisted(()=>({call:vi.fn(),factory:vi.fn()}));
vi.mock('firebase/functions',()=>({httpsCallable:h.factory}));
vi.mock('./firebase',()=>({functions:{preview:true}}));
import{verifyEnteredGift}from'./gift-verification-service';
it('uses only existing lookupGift and discards private response fields before returning',async()=>{
 h.factory.mockReturnValue(h.call);h.call.mockResolvedValue({data:{state:'expired',status:'ACTIVE',amountPaise:60000,tail:'2345',buyerId:'PRIVATE',claimedBy:'PRIVATE',bookingId:'PRIVATE',voidReason:'PRIVATE',codeHash:'PRIVATE'}});
 const r=await verifyEnteredGift('GWABCD2345');expect(h.factory).toHaveBeenLastCalledWith({preview:true},'lookupGift');expect(h.call).toHaveBeenLastCalledWith({code:'GWABCD2345'});expect(r).toEqual({state:'expired',amountPaise:60000,tail:'2345'});expect(JSON.stringify(r)).not.toContain('PRIVATE');
});
it('fails closed on unexpected status or malformed amount without retaining response details',async()=>{
 h.call.mockResolvedValue({data:{state:'unknown private text',amountPaise:60000,tail:'2345'}});await expect(verifyEnteredGift('GWABCD2345')).rejects.toThrow('Invalid gift response');
});
