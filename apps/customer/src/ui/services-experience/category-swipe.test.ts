import {test,expect,vi} from 'vitest';
import {installCategorySwipe} from './category-swipe';
class Rail extends EventTarget{scrollLeft=30}
function touch(rail:Rail,type:string,x:number,y:number){const e=new Event(type,{cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[{clientX:x,clientY:y}]});rail.dispatchEvent(e);return e}
test('horizontal swipe moves the category rail and blocks the trailing tap, not a vertical page gesture',()=>{
 vi.useFakeTimers();const rail=new Rail(),off=installCategorySwipe(rail as unknown as HTMLElement);
 touch(rail,'touchstart',200,20);expect(touch(rail,'touchmove',100,22).defaultPrevented).toBe(true);expect(rail.scrollLeft).toBe(130);touch(rail,'touchend',100,22);
 const click=new Event('click',{cancelable:true});rail.dispatchEvent(click);expect(click.defaultPrevented).toBe(true);
 touch(rail,'touchstart',100,20);expect(touch(rail,'touchmove',103,100).defaultPrevented).toBe(false);expect(rail.scrollLeft).toBe(130);touch(rail,'touchend',103,100);
 const tap=new Event('click',{cancelable:true});rail.dispatchEvent(tap);expect(tap.defaultPrevented).toBe(false);
 off();touch(rail,'touchstart',200,20);touch(rail,'touchmove',100,20);expect(rail.scrollLeft).toBe(130);vi.useRealTimers();
});
test('right swipe restores earlier tabs and canceled touches do not suppress a tap',()=>{
 vi.useFakeTimers();const rail=new Rail(),off=installCategorySwipe(rail as unknown as HTMLElement);
 touch(rail,'touchstart',100,20);touch(rail,'touchmove',125,20);expect(rail.scrollLeft).toBe(5);touch(rail,'touchcancel',125,20);
 const click=new Event('click',{cancelable:true});rail.dispatchEvent(click);expect(click.defaultPrevented).toBe(false);off();vi.useRealTimers();
});
