import {describe,it,expect} from 'vitest';
import {detailingServices,detailingServiceFor,detailingOptionLabel} from './detailing-services';
const make=(id:string,name:string,family:string,brand='Standard',price=300000):any=>({id,name,brand,active:true,basePrice:price,customerMenu:{home:'detailing',family}});
describe('Detailing service-first hierarchy',()=>{
 it('lists Glass coating once and preserves the three option identities and prices',()=>{
  const standard=make('glass','Glass Coating','Glass'),kovalent=make('kg','Kovalent Glass','Glass','Kovalent',450000),koch=make('kc','Koch Chemie Glass Coating','Glass','Koch Chemie',550000);
  const rows=[standard,kovalent,koch];const groups=detailingServices(rows);
  expect(groups).toHaveLength(1);expect(groups[0]?.title).toBe('Glass Coating');expect(groups[0]?.family).toBe('Glass');expect(groups[0]?.options).toEqual(rows);
  expect(detailingServiceFor(koch,rows)).toEqual(groups[0]);expect(groups[0]?.options.map(detailingOptionLabel)).toEqual(['Standard','Kovalent','Koch Chemie']);expect(groups[0]?.options.map(s=>s.basePrice)).toEqual([300000,450000,550000]);
 });
 it('groups applicable brand variants across Fabric, Leather and Trim without merging different work',()=>{
  const rows=[make('fabric','Fabric','Fabric'),make('kf','Kovalent Fabric','Fabric','Kovalent'),make('leather','Leather','Leather'),make('kl','Kovalent Restore - leather','Leather','Kovalent'),make('trim','Trim Restoration','Trim restoration'),make('kt','Kovalent Restore - trim restoration','Trim restoration','Kovalent'),make('menu-coat-wheels','Wheels','Wheels & trim'),make('svc_c2f74071fe48615845d9b26f6be63d22','Wheels Spray','Wheels & trim')];
  const groups=detailingServices(rows);expect(groups.map(g=>g.title)).toEqual(['Fabric','Leather','Trim Restoration','Wheels']);expect(groups.slice(0,3).map(g=>g.options.length)).toEqual([2,2,2]);expect(groups.slice(3).map(g=>g.options.length)).toEqual([2]);
 });
 it('brand-only treatments still have a service-first title without inventing Standard',()=>{const row=make('overlay','Kovalent Overlay','Film aftercare','Kovalent');const entry=detailingServices([row])[0]!;expect(entry.title).toBe('Film aftercare');expect(entry.options).toEqual([row]);expect(entry.options.map(detailingOptionLabel)).toEqual(['Kovalent']);});
 it('excludes inactive records and leaves other categories alone',()=>{const active=make('a','Glass Coating','Glass');const inactive={...make('i','Other','Glass'),active:false};const paint={...make('p','Ceramic','Ceramic'),customerMenu:{home:'paint',family:'Ceramic'}};expect(detailingServices([active,inactive,paint])).toHaveLength(1);});
});
