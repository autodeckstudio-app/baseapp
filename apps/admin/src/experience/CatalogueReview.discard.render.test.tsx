import React from'react';import{create,act}from'react-test-renderer';import{it,expect,vi}from'vitest';
const h=vi.hoisted(()=>({discarded:[]as any[]}));
vi.mock('../lib/catalogue-drafts',()=>({getCatalogueDraftHistory:async()=>({history:[],nextHistoryCursor:null}),publicCatalogueDestinations:['Wash and care']}));
import{CatalogueReview}from'./CatalogueReview';
const draft=(over:any={})=>({id:'d1',serviceId:null,expectedServiceUpdatedAt:null,version:2,state:'draft',payload:{name:'Synthetic Draft Wash',category:'washing',basePrice:50000,estimatedDurationMinutes:30,requiredBayType:'wash',description:'Synthetic included work',priceOnRequest:false,brand:null},reviewHash:null,updatedAt:'2026-11-10T00:00:00.000Z',...over});
const onDiscard=async(d:any)=>{h.discarded.push(d)};
it('discard requires the explicit confirm and reports the exact draft; keep cancels safely',async()=>{
 let r:any;await act(async()=>{r=create(<CatalogueReview drafts={[draft()]} onReview={async()=>{}} onDiscard={onDiscard} busy={false}/>)});
 const btn=(label:string)=>r.root.findAllByType('button').find((b:any)=>b.props.children===label);
 // Open the draft details first.
 await act(async()=>r.root.findAllByType('button').find((b:any)=>b.props.children==='Synthetic Draft Wash').props.onClick());
 expect(JSON.stringify(r.toJSON())).not.toContain('cannot be undone');
 expect(h.discarded).toHaveLength(0);
 // First click only arms the confirm; nothing is discarded.
 await act(async()=>btn('Discard draft').props.onClick());
 expect(JSON.stringify(r.toJSON())).toContain('The live service and past bookings are not affected. This cannot be undone.');
 expect(h.discarded).toHaveLength(0);
 // Keep cancels back to the plain button.
 await act(async()=>btn('Keep draft').props.onClick());
 expect(JSON.stringify(r.toJSON())).not.toContain('cannot be undone');
 expect(h.discarded).toHaveLength(0);
 // Arm again and confirm: exactly one discard of the exact draft.
 await act(async()=>btn('Discard draft').props.onClick());
 await act(async()=>btn('Yes, discard draft').props.onClick());
 expect(h.discarded).toEqual([expect.objectContaining({id:'d1',version:2})]);
 await act(async()=>r.unmount());
});
it('published history rows never show a discard control',async()=>{
 let r:any;await act(async()=>{r=create(<CatalogueReview drafts={[draft({id:'p1',state:'published',version:5})]} onReview={async()=>{}} onDiscard={onDiscard} busy={false}/>)});
 await act(async()=>r.root.findAllByType('button').find((b:any)=>b.props.children==='Synthetic Draft Wash').props.onClick());
 const json=JSON.stringify(r.toJSON());
 expect(json).not.toContain('Discard draft');
 expect(json).toContain('Published');
 await act(async()=>r.unmount());
});
