import React from'react';import{it,expect,vi,beforeEach}from'vitest';import{act,create}from'react-test-renderer';
const h=vi.hoisted(()=>({ids:['a']as string[],scope:'owner-a',category:'sedan'as string|null,price:vi.fn()}));
vi.mock('../hooks/useServiceSelection',()=>({useServiceSelection:()=>({ids:h.ids,scope:h.scope})}));vi.mock('../lib/vehicle-size',()=>({usePricingVehicle:()=>({category:h.category})}));vi.mock('../lib/catalogue-service',()=>({calculateServicePrice:(...args:any[])=>h.price(...args)}));vi.mock('./kit',()=>({T:'T',rupees:(v:number)=>`PRICE:${v}`}));vi.mock('../lib/raised',()=>({raised:()=>({card:{}})}));vi.mock('@autodeck/ui/native',()=>({useExperienceTheme:()=>({name:'light',colors:{accent:'#123'}})}));
import{ServiceSelectionBar}from'./ServiceSelectionBar';
const rows:any[]=[{id:'a',active:true,name:'A',category:'garage',description:'AC cleaning',requiredBayType:'general'},{id:'b',active:true,name:'B',category:'garage',description:'Coolant replacement',requiredBayType:'general'}];const view=(services=rows)=><ServiceSelectionBar services={services} onReview={()=>{}}/>;const text=(r:any)=>JSON.stringify(r.toJSON());
beforeEach(()=>{h.ids=['a'];h.scope='owner-a';h.category='sedan';h.price.mockReset();h.price.mockResolvedValue({breakdown:{total:60000}})});
it('shows only response-priced totals and prices the exact ordered extras',async()=>{h.ids=['b','a'];let r:any;await act(async()=>{r=create(view())});expect(h.price).toHaveBeenCalledWith('b','sedan',['a']);expect(text(r)).toContain('PRICE:60000');await act(async()=>r.unmount())});
it('a slow price response cannot leak into changed service or owner scope',async()=>{let old!:(v:any)=>void,next!:(v:any)=>void;h.price.mockImplementationOnce(()=>new Promise(r=>old=r)).mockImplementationOnce(()=>new Promise(r=>next=r));let r:any;await act(async()=>{r=create(view())});h.ids=['b'];h.scope='owner-b';await act(async()=>r.update(view()));await act(async()=>old({breakdown:{total:11111}}));expect(text(r)).not.toContain('PRICE:11111');await act(async()=>next({breakdown:{total:22222}}));expect(text(r)).toContain('PRICE:22222');await act(async()=>r.unmount())});
it.each(['withdrawn','no-car','alternative-coating'])('does not invent or request a payable total for %s scope',async kind=>{h.ids=['a','b'];let services=rows.map(s=>({...s}));if(kind==='withdrawn')services[1].active=false;if(kind==='no-car')h.category=null;if(kind==='alternative-coating')services=services.map(s=>({...s,category:'ceramic'}));let r:any;await act(async()=>{r=create(view(services))});expect(h.price).not.toHaveBeenCalled();expect(text(r)).not.toContain('PRICE:');await act(async()=>r.unmount())});

it('mixed bays show only complete server-priced service subtotal with settlement exclusions',async()=>{
 h.ids=['a','b'];const services=rows.map(s=>({...s}));services[1].requiredBayType='wash';
 h.price.mockResolvedValueOnce({breakdown:{total:50000,currency:'INR'}}).mockResolvedValueOnce({breakdown:{total:60000,currency:'INR'}});
 let r:any;await act(async()=>{r=create(view(services))});
 expect(h.price.mock.calls).toEqual([['a','sedan'],['b','sedan']]);
 expect(text(r)).toContain('Service subtotal PRICE:110000');
 expect(text(r)).toContain('Membership/transport not included.');
 expect(text(r)).toContain('Not final booking price.');
 expect(text(r)).toContain('Timing by studio');
 await act(async()=>r.unmount());
});
it.each(['missing-currency','foreign-currency','negative','fractional','unsafe','failed'])('mixed subtotal stays unknown for %s response',async kind=>{
 h.ids=['a','b'];const services=rows.map(s=>({...s}));services[1].requiredBayType='wash';
 h.price.mockResolvedValueOnce({breakdown:{total:50000,currency:'INR'}});
 if(kind==='failed')h.price.mockRejectedValueOnce(new Error('Unavailable'));
 else h.price.mockResolvedValueOnce({breakdown:{total:kind==='negative'?-1:kind==='fractional'?1.5:kind==='unsafe'?Number.MAX_SAFE_INTEGER:60000,currency:kind==='missing-currency'?undefined:kind==='foreign-currency'?'USD':'INR'}});
 let r:any;await act(async()=>{r=create(view(services))});
 expect(text(r)).not.toContain('PRICE:');expect(text(r)).toContain('Prices in review');
 await act(async()=>r.unmount());
});
