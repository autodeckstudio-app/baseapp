import React from'react';import{act,create}from'react-test-renderer';import{it,vi,expect}from'vitest';vi.mock('react-native',()=>({View:'View'}));vi.mock('./kit',()=>({Button:'Button',Kicker:'Kicker',Pane:'Pane',Row:'Row',T:'T'}));import{PpfSelection}from'./PpfSelection';
const rows=[{id:'body',active:true,category:'ppf',brand:'XPEL',coverageLevel:'full_body',name:'XPEL Full body',basePrice:20000},{id:'front',active:true,category:'ppf',brand:'XPEL',coverageLevel:'full_front',name:'XPEL Full front',basePrice:10000}]as any;
it('confirmed film brands offer brand-level enquiries; injected old package rows cannot create a product or booking offer',async()=>{
  const enquiry=vi.fn(),service=vi.fn();let r:any;
  await act(async()=>{r=create(<PpfSelection services={rows} onService={service} onEnquiry={enquiry} priceLabel={s=>'₹'+s.basePrice}/>)});
  // The XPEL package rows stay unconfirmed: no bookable product, no price, no service callback.
  expect(JSON.stringify(r.toJSON())).not.toContain('XPEL Full body');
  expect(service).not.toHaveBeenCalled();
  // Brand rows for the seven owner-confirmed brands (8 Nov) plus the brand-less PPS concept.
  const titles=()=>r.root.findAllByType('Row').map((x:any)=>x.props.title);
  expect(titles()).toEqual(['LLumar','Garware','XPEL','Avery Dennison','AVVYX','NAR','GSWF','PPS - spray-on paint protection']);
  // Choosing a brand shows its one brand-level film entry plus the studio-confirm option.
  await act(async()=>r.root.findAllByType('Row').find((x:any)=>x.props.title==='Garware').props.onPress());
  expect(titles()).toEqual(['Garware PPF','Let the studio confirm the film']);
  await act(async()=>r.root.findAllByType('Row').find((x:any)=>x.props.title==='Garware PPF').props.onPress());
  // Coverage is confirmed with the studio through the enquiry route: no price, no booking.
  await act(async()=>r.root.findAllByType('Row').find((x:any)=>x.props.title==='Confirm panels with the studio').props.onPress());
  expect(enquiry).toHaveBeenCalledWith('garware-ppf','Garware PPF: please confirm coverage and quote.');
  expect(service).not.toHaveBeenCalled();
  // The brand-less PPS concept still routes to enquiry from the brand list.
  await act(async()=>r.root.findAllByType('Button').find((x:any)=>x.props.label==='Back to film choice').props.onPress());
  await act(async()=>r.root.findAllByType('Button').find((x:any)=>x.props.label==='Change brand').props.onPress());
  await act(async()=>r.root.findAllByType('Row').find((x:any)=>x.props.title==='PPS - spray-on paint protection').props.onPress());
  expect(enquiry).toHaveBeenCalledWith('pps-spray');
  await act(async()=>r.unmount());
});
