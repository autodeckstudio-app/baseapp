vi.mock('react-native',async()=>{const actual=await vi.importActual<any>('react-native');return{...actual,Image:'Image'}});
vi.mock('./ServicePhoto',()=>({ServicePhoto:()=>null}));
import React from'react';import{it,expect,vi}from'vitest';import{create,act}from'react-test-renderer';vi.mock('./kit',()=>({Button:'Button',Pane:'Pane',T:'T'}));import{Pressable}from'react-native';import{ServiceHomes}from'./ServiceHomes';
it('five-home path exposes only confirmed references, confirmed PPF brands, and no held or inactive offering',async()=>{let r:any;const open=vi.fn(),reference=vi.fn();await act(async()=>{r=create(<ServiceHomes services={[{id:'menu-coat-kovalent-graphene',active:false,name:'Injected inactive',category:'ceramic'}]as any} onOpen={open} onReference={reference} priceLabel={()=>null}/>)});const home=(s:string)=>r.root.findAllByType(Pressable).find((p:any)=>p.findAllByType('T').some((t:any)=>t.props.children===s));const button=async(s:string)=>{const b=r.root.findAllByType('Button').find((x:any)=>x.props.label===s);expect(b).toBeTruthy();await act(async()=>b.props.onPress())};await act(async()=>home('Paint Protection').props.onPress());await button('Ceramic');await button('Kovalent');expect(JSON.stringify(r.toJSON())).not.toContain('Injected inactive');expect(JSON.stringify(r.toJSON())).not.toContain('Butterfly');await act(async()=>home('Graphene Matrix').props.onPress());expect(reference).toHaveBeenCalledWith('kovalent-matrix',undefined);expect(open).not.toHaveBeenCalled();await button('Change brand');await button('Back to services');// PPF family returns with the seven owner-confirmed film brands (8 Nov): brand
// rows under full-body work only, no named ranges, no held brands, no booking.
await button('PPF');await button('Full-body protection');
const ppfText=JSON.stringify(r.toJSON());
for(const b of ['LLumar','Garware','XPEL','Avery Dennison','AVVYX','NAR','GSWF'])expect(ppfText).toContain(b);
for(const held of ['Ultraguard','SunTek','3M','Defender','ULTIMATE'])expect(ppfText).not.toContain(held);
await button('Garware');
expect(JSON.stringify(r.toJSON())).toContain('Garware PPF');
await act(async()=>r.root.findAllByType(Pressable).find((p:any)=>p.findAllByType('T').some((t:any)=>t.props.children==='Garware PPF')).props.onPress());
expect(reference).toHaveBeenCalledWith('garware-ppf','Full-body protection');
expect(open).not.toHaveBeenCalled();
await act(async()=>r.unmount())});
