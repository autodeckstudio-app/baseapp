import React from 'react';import {act,create} from 'react-test-renderer';import{expect,it}from'vitest';import{BoundedListNotice}from'./BoundedListNotice';
it('qualifies both live lists without claiming undiscovered older records exist or exhaustive history',async()=>{
 for(const kind of ['bookings','payments']as const){let r:any;await act(async()=>{r=create(<BoundedListNotice kind={kind} limit={300}/>)});const note=r.root.findByProps({role:'note'});expect(note.children.join('')).toContain(`up to 300 ${kind}`);expect(note.children.join('')).toContain(kind==='bookings'?'not the full history':'not a complete ledger');await act(async()=>r.unmount())}
});
