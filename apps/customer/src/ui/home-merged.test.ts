import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
const read=(s:string)=>readFileSync(new URL(s,import.meta.url),'utf8');
const body=read('./HomeScene.tsx');
describe('approved Glacier Home',()=>{
 it('one next action follows canonical owned cars and precedes service choices, membership and studio',()=>{const order=['<HomeOriginalTop','testID="home-state-dock"','testID="home-service-shortcuts"','<HomeClub','<HomeShowroom','The studio,'];const positions=order.map(s=>body.indexOf(s));expect(positions.every(n=>n>=0)).toBe(true);expect([...positions].sort((a,b)=>a-b)).toEqual(positions)});
 it('stories sit directly after welcome and the retained service hero precedes owned-car context',()=>{const top=read('./HomeOriginalTop.tsx');const order=['Welcome to AutoDeck','{p.stories}','accessibilityLabel="Explore services"','<HomeOwnedCars p={p}/>'].map(s=>top.indexOf(s));expect(order.every(n=>n>=0)).toBe(true);expect([...order].sort((a,b)=>a-b)).toEqual(order)});
 it('uses existing canonical selection rather than changing only an image',()=>{expect(read('./HomeOwnedCars.tsx')).toContain('currentProps.onSelectCar?.(car.id)');expect(body).not.toContain('setActive(');expect(body).not.toContain('useState(0)')});
 it('keeps real records and studio actions, with no illustrative account records',()=>{for(const s of ['p.onGarage','p.onStudio','p.quick?.map','p.social.map','p.carsList'])expect(body).toContain(s);for(const s of ['Example vehicle','Work under way','₹','→','↗'])expect(body).not.toContain(s)});
 it('empty cars use one add action and no false photo',()=>{const c=read('./CarChips.tsx');expect(c).toContain('if (cars.length === 0)');expect(c).toContain('onPress={onAdd}');expect(c).toContain('const framed = !!car.vehicle?.photoUrl');expect(read('./HomeClub.tsx')).toContain('>Membership</Text>')});
});
