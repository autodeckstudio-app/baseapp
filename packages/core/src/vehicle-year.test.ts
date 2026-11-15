import{it,expect}from'vitest';import{currentVehicleYear}from'./vehicle-year.js';
it('year rolls at Kolkata midnight rather than server UTC midnight',()=>{expect(currentVehicleYear(new Date('2026-12-31T18:29:59Z'))).toBe(2026);expect(currentVehicleYear(new Date('2026-12-31T18:30:00Z'))).toBe(2027);expect(()=>currentVehicleYear(new Date('bad'))).toThrow()});
