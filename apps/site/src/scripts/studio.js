import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduced) {
  gsap.fromTo('.landing-copy > *',{y:14,opacity:0},{y:0,opacity:1,stagger:.07,duration:.55,clearProps:'all'});
  document.querySelectorAll('.reveal').forEach(el => gsap.fromTo(el,{y:20},{y:0,duration:.65,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 96%',once:true},clearProps:'transform'}));
  const host = document.getElementById('hero-car');
  if(host) import('./hero-car.js').then(({initHeroCar})=>initHeroCar(host)).catch(err=>console.warn('[AutoDeck] 3D unavailable, photograph remains visible.',err));
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',()=>{
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll('[data-category]').forEach(card=>{card.hidden=button.dataset.filter!=='All'&&card.dataset.category!==button.dataset.filter;});
  ScrollTrigger.refresh();
}));
