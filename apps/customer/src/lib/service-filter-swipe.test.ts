import {describe,it,expect} from 'vitest';
import {serviceFilterSwipe} from './service-filter-swipe';
import {swipeTarget} from './segment-swipe-core';
describe('service-local filter swipe',()=>{
 const families=['Exterior wash','Interior cleaning','Complete wash'];
 it('uses the exact visible Washing strip at every depth without switching service area',()=>{
  for(const family of [undefined,...families]){
   const m=serviceFilterSwipe({home:'washing',...(family?{family}:{})},families,'All',false);
   expect(m.enabled).toBe(true);expect(m.keys).toEqual(['All',...families]);expect(m.current).toBe(family??'All');
  }
  expect(swipeTarget(['All',...families],'All',-120,0)).toBe('Exterior wash');
  expect(swipeTarget(['All',...families],'Complete wash',-120,0)).toBeNull();
  expect(swipeTarget(['All',...families],'All',120,0)).toBeNull();
  expect(swipeTarget(['All',...families],'All',30,150)).toBeNull();
 });
 it('uses Garage group filters and leaves Paint hierarchy and root untouched',()=>{
  expect(serviceFilterSwipe({home:'garage'},families,'Wheels & tyres',false)).toMatchObject({enabled:true,current:'Wheels & tyres'});
  for(const path of [{},{home:'paint' as const},{home:'paint' as const,family:'Ceramic'},{home:'paint' as const,family:'Ceramic',brand:'Keramic'}])expect(serviceFilterSwipe(path,families,'All',false).enabled).toBe(false);
 });
 it('does not capture drags while searching, reviewing cart or showing a service',()=>{expect(serviceFilterSwipe({home:'washing'},families,'All',true).enabled).toBe(false)});
});
