import React from'react';import{act,create}from'react-test-renderer';import{it,vi,expect}from'vitest';vi.mock('react-native',()=>({View:'View'}));vi.mock('./kit',()=>({Button:'Button',Kicker:'Kicker',Pane:'Pane',Row:'Row',T:'T'}));import{PpfSelection}from'./PpfSelection';
const rows=[{id:'body',active:true,category:'ppf',brand:'XPEL',coverageLevel:'full_body',name:'XPEL Full body',basePrice:20000},{id:'front',active:true,category:'ppf',brand:'XPEL',coverageLevel:'full_front',name:'XPEL Full front',basePrice:10000}]as any;
it('the confirmed sheet film lineup renders enquiry-only; injected old package rows and held references cannot create a product or booking offer',async()=>{
  const enquiry=vi.fn(),service=vi.fn();let r:any;
  await act(async()=>{r=create(<PpfSelection services={rows} onService={service} onEnquiry={enquiry} priceLabel={s=>'₹'+s.basePrice}/>)});
  const text=()=>JSON.stringify(r.toJSON());
  // The XPEL package rows stay unconfirmed: no bookable product, no price, no service callback.
  expect(text()).not.toContain('XPEL Full body');
  expect(service).not.toHaveBeenCalled();
  // Confirmed film brands plus the brand-less PPS concept, all enquiry-only.
  const titles=r.root.findAllByType('Row').map((x:any)=>x.props.title);
  expect(titles).toEqual(['GSWF','NAR','AVVYX','Ultraguard','Garware','XPEL','LLumar','3M','PPS - spray-on paint protection']);
  // Held references and colour/black films stay hidden (colour films live under Modifications & Wraps > Colour PPF).
  for(const hidden of ['Avery Dennison','Rodium','SunTek','ProWrap','STEK','Legend PPF','Black PPF','White PPF','Select Black'])expect(text()).not.toContain(hidden);
  // Brand -> film -> ask-the-studio enquiry; never a service/booking callback.
  await act(async()=>r.root.findAllByType('Row').find((x:any)=>x.props.title==='XPEL').props.onPress());
  expect(r.root.findAllByType('Row').map((x:any)=>x.props.title)).toEqual(['ULTIMATE FUSION','ULTIMATE PLUS','STEALTH','Let the studio confirm the film']);
  await act(async()=>r.root.findAllByType('Row').find((x:any)=>x.props.title==='ULTIMATE PLUS').props.onPress());
  const confirm=r.root.findAllByType('Row').find((x:any)=>x.props.title==='Confirm panels with the studio');
  expect(confirm).toBeTruthy();
  await act(async()=>confirm.props.onPress());
  expect(enquiry).toHaveBeenCalledWith('xpel-ultimate-plus',expect.stringContaining('XPEL ULTIMATE PLUS'));
  expect(service).not.toHaveBeenCalled();
  await act(async()=>r.unmount());
});
