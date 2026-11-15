import React from 'react';import {act,create} from 'react-test-renderer';import{expect,it}from'vitest';import{BoundedListNotice}from'./BoundedListNotice';
const text=(n:any):string=>typeof n==='string'?n:typeof n==='number'?String(n):n?.children?.map(text).join(' ')??'';
it('qualifies both lists without implying exhaustive history or ledger',async()=>{
 for(const kind of ['bookings','payments']as const){let r:any;await act(async()=>{r=create(<BoundedListNotice kind={kind} limit={300}/>)});const note=r.root.findByProps({role:'note'});const value=text(note).replace(/\s+/g,' ').trim();expect(value).toContain(`Up to 300 ${kind}`);expect(value).toContain(`Loaded ${kind} only`);expect(value).toContain(kind==='bookings'?'Full history':'Full ledger & historical balance');expect(value).toContain('Not included in this view');await act(async()=>r.unmount())}
});
