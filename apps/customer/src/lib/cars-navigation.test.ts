import { describe, it, expect } from 'vitest';
import { freshCarsEntry } from './cars-navigation';
import { backFallback } from './back-nav';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { StackRouter, TabRouter } = createRequire(req.resolve('expo-router/package.json'))('@react-navigation/routers');
const sr = StackRouter({});
const opts = { routeNames: ['index', '[id]', 'sell'], routeParamList: {}, routeGetIdList: {} };
const route = (name: string, key: string, params = {}) => ({ name, key, params });
const stack = (routes: any[]) => ({ type: 'stack', key: 'cars-stack', stale: false, index: routes.length - 1, routes, routeNames: opts.routeNames, preloadedRoutes: [] });
function fix(s: any, page: string, origin?: string) {
  const reset = freshCarsEntry(s, page, origin);
  return reset ? sr.getRehydratedState(sr.getStateForAction(s, { type: 'RESET', payload: reset }, opts), opts) : s;
}
describe('Cars entry navigation using installed production routers', () => {
  it('reproduces selected car underneath See all, then removes it on hub focus', () => {
    const s = stack([route('[id]', 'safari', {id:'safari'}), route('index', 'hub')]);
    expect(sr.getStateForAction(s, {type:'GO_BACK'}, opts).routes[0].key).toBe('safari');
    const clean = fix(s, 'index');
    expect(clean.routes.map((r:any)=>r.name)).toEqual(['index']);
    expect(sr.getStateForAction(clean, {type:'GO_BACK'}, opts)).toBeNull();
    const tr = TabRouter({backBehavior:'history'});
    const to = {routeNames:['index','cars'],routeParamList:{},routeGetIdList:{}};
    const t = tr.getRehydratedState({routes:[route('index','home'), {...route('cars','cars'),state:clean}],index:1,history:[{type:'route',key:'home'},{type:'route',key:'cars'}]},to);
    const b=tr.getStateForAction(t,{type:'GO_BACK'},to);
    expect(b.routes[b.index].name).toBe('index');
  });
  it.each(['[id]', 'sell'])('a direct Home %s shortcut drops a previous hub/detail/form', page => {
    const current = route(page, 'current', {id:'new',returnTo:'home'});
    const clean=fix(stack([route('index','hub'),route('sell','old-form'),current]),page,'home');
    expect(clean.routes).toEqual([current]);
    expect(sr.getStateForAction(clean,{type:'GO_BACK'},opts)).toBeNull();
  });
  it.each(['[id]', 'sell'])('hub -> %s -> Back still restores the same hub and filters', page => {
    const hub=route('index','hub',{tab:'sell'}), detail=route(page,'detail');
    const s=stack([hub,detail]);
    expect(fix(s,page)).toBe(s);
    expect(sr.getStateForAction(s,{type:'GO_BACK'},opts).routes).toEqual([hub]);
  });
  it('keeps params, rejects untrusted origins and ignores stale focus callbacks', () => {
    const s=stack([route('index','hub'),route('[id]','new',{id:'new'})]);
    expect(freshCarsEntry(s,'[id]','https://example.invalid')).toBeNull();
    expect(freshCarsEntry(s,'index','home')).toBeNull();
    expect(freshCarsEntry(undefined,'index',undefined)).toBeNull();
    expect(freshCarsEntry(stack([route('index','hub')]),'index',undefined)).toBeNull();
  });
  it('cold detail/form returns to Cars, cold hub returns Home', () => {
    expect(backFallback(['(tabs)','cars','[id]'])).toBe('/(tabs)/cars');
    expect(backFallback(['(tabs)','cars','sell'])).toBe('/(tabs)/cars');
    expect(backFallback(['(tabs)','cars'])).toBe('/(tabs)');
  });
});

import {readFileSync} from 'node:fs';
const source=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
it('production Home direct listing/Sell callbacks identify their origin',()=>{
 const s=source('app/(tabs)/index.tsx');
 expect(s).toContain('params: {id, returnTo: "home"}');
 expect(s).toContain('pathname: "/(tabs)/cars/sell", params: {returnTo: "home"}');
});
it('cold Inspection/Reschedule/Approval secondary actions have valid fallbacks',()=>{
 for(const p of ['bookings/inspection.tsx','bookings/reschedule.tsx','approvals/[id].tsx']){
  const s=source('app/(tabs)/'+p);expect(s).not.toContain('onPress={() => router.back()}');
  expect(s).toContain('router.canGoBack() ? router.back() : router.replace("/(tabs)/bookings")');
 }
 expect(source('app/(tabs)/approvals/[id].tsx')).toContain('onPress={originBack ??');
 expect(backFallback(['(tabs)','coordinate'])).toBe('/(tabs)/catalogue');
});
