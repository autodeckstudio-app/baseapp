import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { homeCatalogueBack, detailHomeBack, catalogueReturnParams } from './home-service-navigation';
import { backFallback } from './back-nav';
const read=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
it('Home maps invoice/approval/visit/car/Club to real routes with explicit fixed Home origin',()=>{
 const h=read('app/(tabs)/index.tsx');expect(h).toContain('case "payInvoice"');expect(h).toContain('m.dueInvoice');expect(h.indexOf(': m.dueInvoice')).toBeLessThan(h.indexOf(': m.liveJob'));
 for(const path of ['approvals/[id]','bookings/[id]','garage/[id]','membership'])expect(h).toContain(`pathname: "/(tabs)/${path}"`);expect(h.match(/returnTo: "home"/g)!.length).toBeGreaterThanOrEqual(7);
 for(const path of ['approvals/[id].tsx','bookings/[id].tsx','garage/[id].tsx','membership/index.tsx','bookings/invoice.tsx']){const s=read('app/(tabs)/'+path);expect(s).toContain('returnTo === "home" ? () => router.navigate("/(tabs)")');expect(s.match(/onBack=\{originBack\}/g)!.length).toBeGreaterThanOrEqual(2)}
});
it('category choices return through brand/family to Home, including after refresh',()=>{
 const path={home:'paint',family:'Ceramic',brand:'Kovalent'} as const;expect(homeCatalogueBack(path,'coat')).toEqual({home:'paint',family:'Ceramic'});expect(homeCatalogueBack({home:'paint',family:'Ceramic'},'coat')).toBeNull();expect(detailHomeBack(catalogueReturnParams(path,'coat'))).toMatchObject({pathname:'/(tabs)/catalogue',params:{home:'paint',family:'Ceramic',brand:'Kovalent',returnTo:'home'}});expect(detailHomeBack({returnTo:'https://elsewhere.invalid'})).toBeNull();
});
it('existing downstream routes have safe fallback destinations and no invented no-index screens',()=>{
 expect(backFallback(['(tabs)','book','[serviceId]'])).toBe('/(tabs)/catalogue');expect(backFallback(['(tabs)','approvals','[id]'])).toBe('/(tabs)/bookings');expect(backFallback(['(tabs)','cars','[id]'])).toBe('/(tabs)');expect(backFallback(['(tabs)','studio'])).toBe('/(tabs)');
 for(const path of ['catalogue/index.tsx','catalogue/[id].tsx','book/[serviceId].tsx','book/confirm.tsx','bookings/[id].tsx','garage/index.tsx','garage/add.tsx','garage/[id].tsx','membership/index.tsx','cars/index.tsx','cars/[id].tsx','cars/sell.tsx','notifications/index.tsx','studio.tsx'])expect(read('app/(tabs)/'+path).length).toBeGreaterThan(0);
});
