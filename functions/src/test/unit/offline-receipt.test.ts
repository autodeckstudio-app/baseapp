import {it,expect} from 'vitest';
import {allocateOfflineReceipt as allocate}from '../../lib/offline-receipt.js';
it('partial receipt leaves debt, later receipt settles exact balance',()=>{expect(allocate(10000,0,3000)).toEqual({appliedNowPaise:3000,balanceDuePaise:7000,officeReturnDuePaise:0});expect(allocate(10000,3000,7000)).toEqual({appliedNowPaise:7000,balanceDuePaise:0,officeReturnDuePaise:0})});
it('excess belongs to office return, never store credit or revenue',()=>expect(allocate(10000,3000,9000)).toEqual({appliedNowPaise:7000,balanceDuePaise:0,officeReturnDuePaise:2000}));
it.each([[-1,0,1],[100,101,1],[100,0,0],[100,0,0.1],[100,0,NaN],[100,0,Infinity],[Number.MAX_SAFE_INTEGER+1,0,1]])('rejects invalid amounts %j',(t,p,r)=>expect(()=>allocate(t,p,r)).toThrow());
