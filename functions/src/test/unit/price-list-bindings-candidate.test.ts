import{readFileSync}from'node:fs';import{resolve}from'node:path';import{describe,it,expect}from'vitest';
import{priceListGoogleTransport,PRICE_SOURCE_WRITER,type PriceTransportBinding}from'../../lib/price-list-google-sheets.js';
const candidate=JSON.parse(readFileSync(resolve(__dirname,'../../../../sheet-panel/price-list-bindings.candidate.json'),'utf8'));
describe('inactive full-catalogue Price List candidate',()=>{
 it('contains 74 unique identities and stays inactive',()=>{expect(candidate.active).toBe(false);expect(candidate.bindings).toHaveLength(74);expect(new Set(candidate.bindings.map((b:any)=>b.serviceId)).size).toBe(74);});
 it('validates identity/header anchors for all 63 mapped fixed-price offerings without network calls',()=>{const mapped=candidate.bindings.filter((b:any)=>b.policy==='fixed'&&b.tab)as PriceTransportBinding[];expect(mapped).toHaveLength(63);const noNetwork=()=>{throw Error('Unexpected network request');};expect(()=>priceListGoogleTransport({principal:PRICE_SOURCE_WRITER,getAccessToken:async()=>null},mapped,noNetwork as typeof fetch)).not.toThrow();});
 it('keeps PPC and PPS unresolved rather than silently importing or inventing a row',()=>{expect(candidate.bindings.filter((b:any)=>b.status==='reconciliation-required').map((b:any)=>b.name)).toEqual(['Keramic PPC']);const pps=candidate.bindings.find((b:any)=>b.name==='Standard PPS');expect(pps.status).toBe('source-row-required');expect(pps.tab).toBeNull();});
 it('does not mistake inspection-only figures for customer-price cells',()=>{const inspection=candidate.bindings.filter((b:any)=>b.policy==='inspection');expect(inspection).toHaveLength(10);expect(inspection.every((b:any)=>b.column===null)).toBe(true);});
 it('keeps Garware Plus one offering and does not overwrite its internal roll row',()=>{const plus=candidate.bindings.filter((b:any)=>b.name==='Garware Plus');expect(plus).toHaveLength(1);expect(plus[0]).toMatchObject({row:24,column:'L',sourceRows:[23,24],sourceValue:95000});});
});
