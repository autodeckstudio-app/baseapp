import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('saved vehicle size pricing contract',()=>{
 it('requires all six choices and sends category with car creation',()=>{
 const s=read('src/app/(tabs)/garage/add.tsx');expect(s).toContain('if (!size ||');expect(s).toContain('category: size');
 const sizes=read('src/lib/vehicle-size.ts');for(const x of ['hatchback','sedan','suv','luxury','van','commercial'])expect(sizes).toContain(`value:"${x}"`);
 });
 it('uses persisted active vehicle for pricing and price calculation for catalogue',()=>{
 expect(read('src/lib/vehicle-size.ts')).toContain('autodeck.activeVehicle');
 expect(read('src/app/(tabs)/catalogue/index.tsx')).toContain('calculateServicePrice(s.id,pricingVehicle.category!)');
 expect(read('src/app/(tabs)/catalogue/[id].tsx')).toContain('pricingVehicle.category');
 expect(read('src/app/(tabs)/book/[serviceId].tsx')).toContain('setSelectedCategory(selectedVehicle.category)');
 });
});
