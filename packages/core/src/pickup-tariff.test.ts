import{it,expect}from'vitest';import{pickupTariffLegFeePaise as fee,CURRENT_PICKUP_TARIFF as V,LEGACY_PICKUP_TARIFF as OLD,pickupTariffVersion}from'./pickup-tariff';
it.each([[0,0],[2999,0],[3000,0],[3001,2000],[4999,2000],[5000,2000],[5001,2001],[5002,2002],[5003,2004],[5500,2600],[8000,5600],[9000,6800]])('new tariff %im -> %i paise',(m,p)=>expect(fee(m,V)).toBe(p));
it('missing policy remains old; unknown policy fails closed',()=>{expect(fee(8000,undefined)).toBe(12500);expect(fee(8000,OLD)).toBe(12500);expect(()=>fee(8000,'road8')).toThrow();expect(()=>pickupTariffVersion(null)).toThrow()});
it('per leg rounding then sum and directed asymmetry',()=>{expect([5003,8000].reduce((s,m)=>s+fee(m,V),0)).toBe(7604);expect([8000,2900].reduce((s,m)=>s+fee(m,V),0)).toBe(5600)});
it.each([-1,1.5,NaN,Infinity])('invalid metres %s fail',m=>expect(()=>fee(m,V)).toThrow());
