// @ts-nocheck
export function appr(M,SC){
const $=s=>document.querySelector(s);
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;const SNAP=RM||new URLSearchParams(location.search).has('snap');
const E=t=>t*t*(3-2*t),c01=x=>Math.min(1,Math.max(0,x)),sm=(a,b,x)=>E(c01((x-a)/(b-a)));
const drop=$('#drop'),rip=$('#rip');
const L={d:$('#idirty'),c:$('#iclean'),s:$('#iswirl'),g:$('#igloss'),w:$('#iwarm')};
const dip=$('#dip'),layers=$('#layers'),sweepEl=$('#sweep'),h1=$('#h1'),h2=$('#h2'),tag=$('#tag'),chip=$('#chiptxt'),rail=$('#rail'),hint=$('#hint'),sub=$('#sub'),book=$('#book'),journey=$('#journey');
const railItems=[...rail.children];
const mob=()=>matchMedia('(max-width:700px)').matches;
let lastKey='';
function ui(p){
 const k=p<.20?'a':p<.30?'a2':p<.50?'b':p<.68?'c':'e';
 if(k===lastKey)return;lastKey=k;
 const set=(a,b,c)=>{h1.innerHTML=a;h2.innerHTML=b;chip.innerHTML=c};
 h1.classList.remove('off');h2.classList.remove('off');h2.classList.remove('lg');
 if(k==='a'){set('Bring it <i class="ol">dirty.</i>','Scroll to <i class="ol">wash it.</i>','Wash')}
 if(k==='a2'){h1.classList.add('off');h2.classList.add('off');chip.innerHTML='Wash'}
 if(k==='b'){set('','Look <i class="ol">closer.</i>','Inspect');h1.classList.add('off');h2.classList.add('lg');sub.textContent='Under a bright light, every swirl shows.'}
 if(k==='c'){set('','Swirls out.<br class="mb"> <i class="ol">Gloss on.</i>','Polish');h1.classList.add('off');h2.classList.add('lg');sub.textContent='Polishing. Ceramic coating.'}
 if(k==='e'){set('Keys back. <i class="ol">Jaw drops.</i>','','Ready');h2.classList.add('off');sub.textContent=''}
 tag.classList.toggle('off',!(k==='a'||k==='e'));sub.classList.toggle('off',!(k==='b'||k==='c'));
 rail.style.opacity=(k==='b'||k==='c')?1:0;
 railItems.forEach((e,i)=>e.classList.toggle('on',(k==='b'&&i===0)||(k==='c'&&i===1)));
}
const tf=(el,s,ox,oy,x=0,y=0)=>{if(RM){s=1;x=0;y=0}el.style.transformOrigin=ox+'% '+oy+'%';el.style.transform=`translate(${x}%,${y}%) scale(${s})`};
let held=false,pace=0,first=true,P=0,PS=0,last=performance.now(),jH=0,jEnd=0,done=false;
const meas=()=>{jH=journey.offsetHeight;jEnd=journey.getBoundingClientRect().top+SC.y+jH};meas();
const ok=i=>i.complete&&i.naturalWidth>0;const failed=i=>i.complete&&i.naturalWidth===0;const cleanReady=()=>ok(L.c)&&ok(L.d);addEventListener('resize',meas);addEventListener('load',meas);
function frame(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;
 if(window.__p==null&&SC.y>jEnd+SC.h){if(done){requestAnimationFrame(frame);return}}else done=false;const maxS=jH-SC.h;P=RM?.80:c01(SC.y/maxS);if(window.__p!=null)P=window.__p;
 /* hold the wash until both the dirty and clean frames are loaded, so the slide never reveals an empty stage */
 const ready=cleanReady()&&document.documentElement.classList.contains('ready');
 if(!RM&&window.__p==null&&SC.y<jEnd&&P>.035&&!ready&&!failed(L.c)&&!failed(L.d)){P=.035;held=true}
 else if(held){held=false;pace=now+2600}
 if(first){PS=P;first=false}
 /* when the frames finish loading after the visitor already scrolled, play the wash at a readable pace (about 1.4 s for the whole slide) instead of snapping to the end */
 if(!SNAP&&now<pace&&PS<.22&&P>PS)PS=Math.min(P,PS+dt*.12);else PS=SNAP?P:PS+(P-PS)*(1-Math.exp(-dt*7));const p=PS;
 /* wash: bright line L->R, clean behind it, dirty ahead of it (the reel's mechanic) */
 const sw=p<.04?-.03:p>=.19?1.05:-.03+sm(.04,.19,p)*1.08;
 if(RM){L.d.style.clipPath='none';L.d.style.opacity=1-sm(.08,.19,p);sweepEl.style.opacity=0}else{L.d.style.clipPath=`inset(0 0 0 ${Math.max(0,sw*100)}%)`;
 sweepEl.style.opacity=(p>.035&&p<.195)?1:0;sweepEl.style.left=(sw*100)+'%';
 L.d.style.opacity=p>.2?0:1;}
 /* slow push-in on the stage while scrolling, then fly into the hood */
 const fly=sm(.19,.30,p);
 const base=1+p/.2*.04;
 tf(L.c,base+fly*1.6,40,38);tf(L.d,base+fly*1.6,40,38);
 /* macro stages */
 L.s.style.opacity=sm(.25,.30,p)*(1-sm(.40,.50,p));tf(L.s,1.02+c01((p-.30)/.3)*.1,50,50);
 /* the drop: a bead falls onto the bonnet (.50-.60), ripples (.60-.67), then the camera pulls back out to the whole car (.64-.80) */
 const gz=1.02+c01((p-.30)/.3)*.1+sm(.64,.76,p)*.9;
 L.g.style.opacity=sm(.30,.35,p)*(1-sm(.68,.71,p));tf(L.g,gz,50,50);
 const fall=sm(.50,.60,p),ex=sm(.60,.67,p);
 drop.style.opacity=p<.48?0:p<.60?1:1-sm(.60,.64,p);
 drop.style.transform=`translate(-50%,calc(-50% + ${((-1+fall*fall)*36).toFixed(2)}vh)) scale(${1-ex*.2})`;
 rip.style.opacity=p<.60?0:(1-ex)*.9;rip.style.transform=`translate(-50%,-50%) scale(${.3+ex*.9})`;
 const wz=sm(.64,.78,p);const wzz=wz*wz*(3-2*wz);
 L.w.style.opacity=sm(.66,.69,p);tf(L.w,1+(1-wzz)*2.6+(RM?0:c01((p-.78)/.22)*.05),33,50);dip.style.opacity=0;
 const eo=sm(.70,.78,p);if(p>=.68){h1.classList.add('sl');h1.style.opacity=eo;h1.style.transform=`translateY(${((1-eo)*26).toFixed(1)}px)`}else{h1.classList.remove('sl');h1.style.opacity='';h1.style.transform=''}
 /* the clean car fades once macro is up so layers underneath don't show */
 L.c.style.opacity=1-sm(.27,.30,p);
 /* booking: image slides left on desktop, up on mobile */
 const bk=sm(.84,.97,p);if(!RM){book.style.opacity=bk;book.style.pointerEvents=bk>.6?'auto':'none';book.style.transform=mob()?`translateY(${((1-bk)*110).toFixed(1)}%)`:`translate(${((1-bk)*120).toFixed(1)}%,-50%)`}
 if(mob())tf(layers,1,50,50,0,-bk*14);else tf(layers,1+bk*.02,50,50,-bk*8,0);
 if(window.__p==null&&SC.y>jEnd+SC.h&&Math.abs(P-PS)<.002)done=true;
 ui(p);hint.textContent='SCROLL';hint.style.opacity=p<.03?1:0;
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
const goP=p=>SC.to({top:p*(journey.offsetHeight-SC.h),behavior:'smooth'});
document.querySelectorAll('#nav a[data-p]').forEach(a=>a.onclick=()=>goP(+a.dataset.p));
$('#bookbtn').onclick=()=>RM?location.assign('https://app.autodeck.in'):goP(.97);
['veh','svc'].forEach(id=>$('#'+id).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;[...$('#'+id).children].forEach(x=>x.setAttribute('aria-pressed',x===b))}));
const days=$('#days');const d0=new Date();for(let i=0;i<4;i++){const d=new Date(d0.getTime()+(i+1)*864e5);const b=document.createElement('button');b.className='o c';b.setAttribute('aria-pressed','false');b.textContent=d.toLocaleDateString('en-IN',{weekday:'short',day:'numeric'});days.appendChild(b)}
days.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;[...days.children].forEach(x=>x.setAttribute('aria-pressed',x===b))});
Promise.all([L.d,L.c].map(i=>i.decode().catch(()=>{}))).then(()=>{window.__ready=true;document.documentElement.classList.add('ready')});setTimeout(()=>document.documentElement.classList.add('ready'),2500);

}
