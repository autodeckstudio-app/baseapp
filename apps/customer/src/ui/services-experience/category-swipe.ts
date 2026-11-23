type Contact={clientX:number;clientY:number};
type Swipe={x:number;y:number;left:number;axis:'x'|'y'|null};
/** Keep the gesture local to the category rail. A vertical gesture still scrolls the page. */
export function installCategorySwipe(rail:HTMLElement){
 let swipe:Swipe|null=null,moved=false,clear:ReturnType<typeof setTimeout>|undefined;
 const start=(event:TouchEvent)=>{if(event.touches.length!==1){swipe=null;return}const p:Contact|undefined=event.touches[0];if(!p)return;swipe={x:p.clientX,y:p.clientY,left:rail.scrollLeft,axis:null};moved=false;clearTimeout(clear)};
 const move=(event:TouchEvent)=>{if(!swipe||event.touches.length!==1)return;const p=event.touches[0];if(!p)return;const dx=p.clientX-swipe.x,dy=p.clientY-swipe.y;
  if(!swipe.axis){if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;swipe.axis=Math.abs(dx)>Math.abs(dy)?'x':'y'}
  if(swipe.axis!=='x')return;
  moved=true;if(event.cancelable)event.preventDefault();event.stopPropagation();rail.scrollLeft=swipe.left-dx;
 };
 const end=()=>{swipe=null;clear=setTimeout(()=>{moved=false},350)};
 const cancel=()=>{swipe=null;moved=false};
 const click=(event:MouseEvent)=>{if(moved){event.preventDefault();event.stopPropagation();moved=false}};
 rail.addEventListener('touchstart',start,{passive:true});rail.addEventListener('touchmove',move,{passive:false});rail.addEventListener('touchend',end);rail.addEventListener('touchcancel',cancel);rail.addEventListener('click',click,true);
 return()=>{clearTimeout(clear);rail.removeEventListener('touchstart',start);rail.removeEventListener('touchmove',move);rail.removeEventListener('touchend',end);rail.removeEventListener('touchcancel',cancel);rail.removeEventListener('click',click,true)};
}
