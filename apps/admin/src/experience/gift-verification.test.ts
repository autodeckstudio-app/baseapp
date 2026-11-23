import{it,expect}from'vitest';import{safeGiftResult}from'./GiftVerification';import{readFileSync}from'node:fs';
it('projects only safe entered-code values and rejects invalid responses',()=>{expect(safeGiftResult({state:'unused',amountPaise:50000,tail:'2345',buyerId:'PRIVATE',codeHash:'SECRET',claimedBy:'PRIVATE'})).toEqual({state:'unused',amountPaise:50000,tail:'2345'});for(const v of [null,{}, {state:'unused',amountPaise:NaN,tail:'2345'},{state:'unused',amountPaise:50000,tail:'GWABCD2345'}])expect(()=>safeGiftResult(v)).toThrow()});
it('component delegates the existing checker without importing mutations',()=>{const s=readFileSync(new URL('./GiftVerification.tsx',import.meta.url),'utf8');expect(s).not.toContain('httpsCallable');expect(s).not.toContain('giftSecrets');expect(s).not.toContain('voidGift');});

import React from 'react';
import {act,create} from 'react-test-renderer';
import {vi} from 'vitest';
import {GiftVerification} from './GiftVerification';
it('waits for an entered code, singleflights and hides stale and private result fields',async()=>{
 let finish:(value:unknown)=>void=()=>{};
 const lookup=vi.fn().mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve})).mockResolvedValue({state:'unused',amountPaise:123450,tail:'2345',buyerId:'PRIVATE_BUYER',codeHash:'PRIVATE_HASH'});
 let r!:ReturnType<typeof create>;await act(async()=>{r=create(React.createElement(GiftVerification,{lookup}))});
 expect(lookup).not.toHaveBeenCalled();
 const input=()=>r.root.findByType('input');const button=()=>r.root.findByType('button');
 await act(async()=>input().props.onChange({target:{value:'gw-abcd-2345'}}));
 await act(async()=>{button().props.onClick();button().props.onClick()});expect(lookup).toHaveBeenCalledTimes(1);expect(lookup).toHaveBeenCalledWith('GWABCD2345');
 await act(async()=>input().props.onChange({target:{value:'GWBCDE2345'}}));
 await act(async()=>finish({state:'unused',amountPaise:987600,tail:'6789'}));expect(JSON.stringify(r.toJSON())).not.toContain('6789');
 await act(async()=>button().props.onClick());const text=JSON.stringify(r.toJSON());expect(text).toContain('1,234.5');expect(text).not.toContain('PRIVATE_');expect(text).toContain('2345');
 await act(async()=>r.unmount());
});
it('rejects unrecognized status, fractional paise and excess response text',()=>{
 for(const raw of [{state:'PRIVATE_RESPONSE_TEXT',amountPaise:100,tail:'2345'},{state:'unused',amountPaise:123.4,tail:'2345'}])expect(()=>safeGiftResult(raw)).toThrow();
});
