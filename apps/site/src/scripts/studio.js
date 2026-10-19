import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroVideo = document.querySelector('.hero-video');
if (heroVideo && (reduced || navigator.connection?.saveData)) { heroVideo.removeAttribute('autoplay'); heroVideo.pause(); }
if (!reduced) {
  gsap.fromTo('.landing-copy > *',{y:14,opacity:0},{y:0,opacity:1,stagger:.07,duration:.55,clearProps:'all'});
  window.setTimeout(()=>gsap.set('.landing-copy > *',{opacity:1,y:0,clearProps:'all'}),1600);
  document.querySelectorAll('.reveal').forEach(el => gsap.fromTo(el,{y:20},{y:0,duration:.65,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 96%',once:true},clearProps:'transform'}));
}
document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',()=>{
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  document.querySelectorAll('[data-category]').forEach(card=>{card.hidden=button.dataset.filter!=='All'&&card.dataset.category!==button.dataset.filter;});
  ScrollTrigger.refresh();
}));
// The page scrolls normally. Only the preview changes; no scroll interception or artificial pin spacer.
const chapters = [...document.querySelectorAll('[data-chapter]')];
const screens = [...document.querySelectorAll('[data-screen]')];
const dots = [...document.querySelectorAll('[data-dot]')];
function selectChapter(id) {
  chapters.forEach(el => el.classList.toggle('is-active', el.dataset.chapter === id));
  screens.forEach(el => { const active = el.dataset.screen === id; el.classList.toggle('is-active', active); el.setAttribute('aria-hidden', String(!active)); });
  dots.forEach(el => el.classList.toggle('is-active', el.dataset.dot === id));
  const activeChapter = chapters.find(el => el.dataset.chapter === id);
  if (activeChapter) {
    document.querySelector('[data-stage-index]').textContent = activeChapter.querySelector('.chapter-index').textContent;
    document.querySelector('[data-stage-title]').textContent = activeChapter.querySelector('h3').textContent;
    document.querySelector('[data-stage-body]').textContent = activeChapter.querySelector('p:not(.chapter-index)').textContent;
  }
}
if (chapters.length && !reduced) {
  document.querySelector('.app-story').classList.add('app-story-enhanced');
  chapters.forEach(el => el.setAttribute('aria-hidden', 'true'));
  let queued = false;
  const update = () => {
    queued = false;
    const middle = window.innerHeight * .52;
    const closest = chapters.reduce((best, el) => {
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      return !best || distance < best.distance ? {id: el.dataset.chapter, distance} : best;
    }, null);
    if (closest) selectChapter(closest.id);
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', queue, {passive:true});
  window.addEventListener('resize', queue);
  update();
}
