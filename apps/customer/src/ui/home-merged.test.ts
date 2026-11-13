import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
const body = readFileSync(new URL('./HomeScene.tsx', import.meta.url), 'utf8');
describe('reviewed whole Home scene',()=>{
 it('has one personal stage and state dock, then visual discovery, Club, showroom and studio',()=>{const order=['testID="home-personal-stage"','testID="home-state-dock"','Complete car care.','testID="home-service-triad"','testID="home-club"','<HomeShowroom','The studio,'];const pos=order.map(s=>body.indexOf(s));expect(pos.every(x=>x>=0)).toBe(true);expect([...pos].sort((a,b)=>a-b)).toEqual(pos);for(const key of order)expect(body.split(key)).toHaveLength(2)});
 it('does not reintroduce stacked old heroes, decorative arrows or invented progress',()=>{for(const key of ['<LiveCard','<LeadCard','<CarChips','<KenBurns','LIVE_STEPS','↗','→','↓'])expect(body).not.toContain(key)});
 it('keeps the exact one-line Club heading and catalog-backed service keys',()=>{expect(body).toContain('>Make care a habit</Text>');expect(body).toContain('numberOfLines={1} adjustsFontSizeToFit');expect(body).toContain('pickTopServices(p.services)');expect(body).toContain('p.onService(s.service, s.key)')});
 it('uses only canonical active vehicle, not local photo-only switching',()=>{expect(body).toContain('const car = p.cars[0]');expect(body).toContain('onPress={p.onGarage}');expect(body).not.toContain('setActive(')});
 it('empty-car primary action adds a car and does not show an empty personal photo',()=>{expect(body).toContain(": p.onAddCar)");expect(body).toContain('{car ? <Pressable');});
});
