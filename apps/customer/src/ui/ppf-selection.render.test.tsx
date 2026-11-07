import React from'react';import{act,create}from'react-test-renderer';import{it,vi,expect}from'vitest';vi.mock('react-native',()=>({View:'View'}));vi.mock('./kit',()=>({Button:'Button',Kicker:'Kicker',Pane:'Pane',Row:'Row',T:'T'}));import{PpfSelection}from'./PpfSelection';
const rows=[{id:'body',active:true,category:'ppf',brand:'XPEL',coverageLevel:'full_body',name:'XPEL Full body',basePrice:20000},{id:'front',active:true,category:'ppf',brand:'XPEL',coverageLevel:'full_front',name:'XPEL Full front',basePrice:10000}]as any;
it('held film references and injected old package rows cannot create a product or booking offer',async()=>{
  const enquiry=vi.fn(),service=vi.fn();let r:any;
  await act(async()=>{r=create(<PpfSelection services={rows} onService={service} onEnquiry={enquiry} priceLabel={s=>'₹'+s.basePrice}/>)});
  // The XPEL package rows stay unconfirmed: no bookable product, no price, no service callback.
  expect(JSON.stringify(r.toJSON())).not.toContain('XPEL Full body');
  expect(service).not.toHaveBeenCalled();
  // The one Row is the confirmed brand-less PPS concept: ask-for-details, routed to enquiry.
  const rows2=r.root.findAllByType('Row');
  expect(rows2).toHaveLength(1);
  expect(rows2[0].props.title).toBe('PPS - spray-on paint protection');
  expect(rows2[0].props.detail).toBe('Different from film; ask for details');
  await act(async()=>rows2[0].props.onPress());
  expect(enquiry).toHaveBeenCalledWith('pps-spray');
  await act(async()=>r.unmount());
});
