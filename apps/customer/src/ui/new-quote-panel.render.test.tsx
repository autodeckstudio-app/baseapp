import React from'react';import{Pressable}from'react-native';import{act,create}from'react-test-renderer';import{it,expect,vi}from'vitest';vi.mock('./QuoteSchedule',()=>({QuoteSchedule:()=>null}));vi.mock('../lib/service-quote',()=>({getQuoteInspectionTerms:vi.fn(),updateServiceQuote:vi.fn(),quoteOperationId:()=> 'operation'}));import{CustomerQuotePanel}from'./CustomerQuotePanel';import{LiveJobCard}from'./LiveJobCard';import{Button}from'./kit';
const q:any={id:'q',scope:{coverage:'Full body'},phase:'offered',offer:{revision:1,totalPaise:100000,workingMinutes:1440,included:'Exact work',excluded:'Existing damage',termsVersion:'v1'},findings:null};
it('customer sees exact offer and separate choices, never an assumed time',async()=>{let r:any;await act(async()=>{r=create(<CustomerQuotePanel quote={q} onChange={()=>{}}/>)});const labels=r.root.findAllByType(Button).map((b:any)=>b.props.label);expect(labels).toContain('Accept this quote');expect(labels).toContain('Inspect my car first');expect(JSON.stringify(r.toJSON())).not.toContain('scheduledTime');await act(async()=>r.unmount())});
it.each(['approved','rejected','expired','cancelled','unknown'])('resolved or unknown %s approval has no approve/reject controls',async status=>{let r:any;await act(async()=>{r=create(<LiveJobCard status="IN_PROGRESS" readyText={null} approvals={[{id:'a',status,priceImpact:100,newTotal:200,serviceName:'More work'}as any]} busyId={null} error={null} onDecide={()=>{}}/>)});expect(r.root.findAllByType(Button)).toHaveLength(0);await act(async()=>r.unmount())});

import{updateServiceQuote}from'../lib/service-quote';
it('reference consent resets on revision and decline sends exact revision without booking',async()=>{let r:any;const onChange=vi.fn();const ref={...q,requestedReference:{key:'original',name:'Requested film',group:'ppf'}};vi.mocked(updateServiceQuote).mockResolvedValue({...ref,phase:'declined'});await act(async()=>{r=create(<CustomerQuotePanel quote={ref} onChange={onChange}/>);});const b=(label:string)=>r.root.findAllByType(Button).find((x:any)=>x.props.label===label);expect(b('Accept this quote').props.disabled).toBe(true);await act(async()=>b('Review product difference').props.onPress());expect(b('Accept this quote').props.disabled).toBe(false);const next={...ref,offer:{...ref.offer,revision:2}};await act(async()=>r.update(<CustomerQuotePanel quote={next} onChange={onChange}/>));expect(b('Accept this quote').props.disabled).toBe(true);await act(async()=>b('Decline quote').props.onPress());expect(updateServiceQuote).toHaveBeenCalledWith(next,'operation',{kind:'answer',decision:'decline',offerRevision:2});expect(onChange).toHaveBeenCalledWith(expect.objectContaining({phase:'declined'}));await act(async()=>r.unmount())});

import{getQuoteInspectionTerms}from'../lib/service-quote';
it('inspection_requested: a failed terms fetch shows a retry, not a blank; retry loads hours and the app itself guarantees no bay',async()=>{
 const qi:any={id:'q2',scope:{coverage:'Full body'},phase:'inspection_requested',offer:null,findings:null};
 const terms={version:'t1',feePaise:0,hoursText:'Mon-Sat 09:00-21:00',hoursValidUntil:Date.now()+864e5};
 vi.mocked(getQuoteInspectionTerms).mockRejectedValueOnce(new Error('network')).mockResolvedValue(terms as any);
 let r:any;await act(async()=>{r=create(<CustomerQuotePanel quote={qi} onChange={()=>{}}/>);});
 let labels=r.root.findAllByType(Button).map((b:any)=>b.props.label);
 expect(labels).toContain('Try again');
 expect(JSON.stringify(r.toJSON())).toContain('Opening hours could not be loaded.');
 await act(async()=>r.root.findAllByType(Button).find((b:any)=>b.props.label==='Try again').props.onPress());
 await act(async()=>{});
 await act(async()=>r.root.findAllByType(Pressable).find((b:any)=>b.props.accessibilityLabel==='Opening hours').props.onPress());
 const txt=JSON.stringify(r.toJSON());
 expect(txt).toContain('Mon-Sat 09:00-21:00');
 expect(txt).toContain('No slot or bay is reserved.');
 expect(r.root.findAllByType(Button).map((b:any)=>b.props.label)).toContain('Confirm free walk-in');
 await act(async()=>r.unmount());
});

it('inspection_requested: when the server hoursText already carries the no-bay guarantee the app does not duplicate it',async()=>{
 const qi:any={id:'q3',scope:{coverage:'Full body'},phase:'inspection_requested',offer:null,findings:null};
 vi.mocked(getQuoteInspectionTerms).mockResolvedValue({version:'t2',feePaise:0,hoursText:'Walk in Mon-Sat. No slot or bay is reserved.',hoursValidUntil:Date.now()+864e5} as any);
 let r:any;await act(async()=>{r=create(<CustomerQuotePanel quote={qi} onChange={()=>{}}/>);});
 const txt=JSON.stringify(r.toJSON());
 expect(txt.match(/No slot or bay is reserved\./g)).toHaveLength(1);
 await act(async()=>r.unmount());
});

it('confirmed inspection keeps approval and no reservation visible, hours disclosure preserves exact server text',async()=>{
 const hours='Sun 10:00-19:00 · Mon 10:00-21:00 (Asia/Kolkata). No slot or bay is reserved.';
 let r:any;await act(async()=>{r=create(<CustomerQuotePanel quote={{...q,phase:'inspection_confirmed',offer:null,inspection:{hoursText:hours}}} onChange={()=>{}}/>)});
 const text=()=>JSON.stringify(r.toJSON());expect(text()).toContain('You approve before service starts');expect(text()).toContain('No slot or bay is reserved.');expect(text()).not.toContain('Sun 10:00');
 const toggle=()=>r.root.findAllByType(Pressable).find((b:any)=>b.props.accessibilityLabel==='Opening hours'||b.props.accessibilityLabel==='Hide opening hours');await act(async()=>toggle().props.onPress());expect(text()).toContain('Sun 10:00-19:00');expect(text().match(/No slot or bay is reserved\./g)).toHaveLength(1);await act(async()=>toggle().props.onPress());expect(text()).not.toContain('Sun 10:00');await act(async()=>r.unmount());
});
