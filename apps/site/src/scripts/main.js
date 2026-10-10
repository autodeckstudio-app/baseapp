import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: 'power3.out', duration: 1 });

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isTouch = window.matchMedia('(hover: none)').matches;

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!prefersReduced) {
  lenis = new Lenis({ duration: 1.15, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

/* anchor scrolling through lenis */
document.querySelectorAll('[data-scroll]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (!id || !id.startsWith('#')) return;
    const el = document.querySelector(id);
    if (!el) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(el, { offset: -84 });
    else el.scrollIntoView({ behavior: 'smooth' });
  });
});

/* ---------- hero entrance ---------- */
const heroLines = document.querySelectorAll('.hero-title .line > span');
gsap.set('.rv-e', { opacity: 0, y: 24 });
const introTl = gsap.timeline({ defaults: { ease: 'power4.out' } });
introTl
  .to(heroLines, { y: 0, duration: 1.25, stagger: 0.09 }, 0.15)
  .to('.rv-e', { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 0.55);

/* ---------- hero WebGL (lazy) ---------- */
const glHost = document.getElementById('hero-gl');
const smallScreen = window.matchMedia('(max-width: 640px)').matches;
if (glHost && !prefersReduced && !smallScreen) {
  const boot = () => import('./hero-gl.js')
    .then((m) => m.initHeroGL(glHost))
    .catch(() => {});
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(boot, { timeout: 1200 });
  } else {
    setTimeout(boot, 350);
  }
}

/* ---------- scroll reveals ---------- */
document.querySelectorAll('.rv').forEach((el) => {
  gsap.fromTo(el,
    { opacity: 0, y: 36 },
    {
      opacity: 1, y: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
});

/* ---------- manifesto word fill ---------- */
const manifesto = document.getElementById('manifesto');
if (manifesto) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((piece) => {
          if (!piece) return;
          if (/^\s+$/.test(piece)) { frag.appendChild(document.createTextNode(piece)); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.textContent = piece;
          frag.appendChild(w);
        });
        node.replaceChild(frag, child);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  walk(manifesto);
  const words = manifesto.querySelectorAll('.w');
  ScrollTrigger.create({
    trigger: manifesto,
    start: 'top 78%',
    end: 'bottom 45%',
    scrub: 0.6,
    onUpdate(self) {
      const lit = Math.floor(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle('lit', i <= lit));
    },
  });
}

/* ---------- image parallax ---------- */
if (!prefersReduced) {
  document.querySelectorAll('[data-px]').forEach((img) => {
    gsap.fromTo(img, { yPercent: -8, scale: 1.12 }, {
      yPercent: 8, scale: 1.12, ease: 'none',
      scrollTrigger: { trigger: img.closest('.px-img') || img, start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });
}

/* ---------- magnetic buttons ---------- */
if (!isTouch && !prefersReduced) {
  document.querySelectorAll('.magnetic').forEach((btn) => {
    const strength = 22;
    btn.addEventListener('mousemove', (e) => {
      const r = btn.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * strength;
      const y = ((e.clientY - r.top) / r.height - 0.5) * strength;
      gsap.to(btn, { x, y, duration: 0.4, ease: 'power3.out' });
    });
    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.4)' });
    });
  });
}

/* ---------- opening countdown ---------- */
const cd = document.getElementById('countdown');
if (cd) {
  const target = new Date(cd.dataset.target || '').getTime();
  const cells = {
    d: cd.querySelector('[data-cd="d"]'),
    h: cd.querySelector('[data-cd="h"]'),
    m: cd.querySelector('[data-cd="m"]'),
    s: cd.querySelector('[data-cd="s"]'),
  };
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const left = target - Date.now();
    if (!Number.isFinite(target) || left <= 0) {
      cd.classList.add('done');
      cells.d.textContent = '00';
      cells.h.textContent = '00';
      cells.m.textContent = '00';
      cells.s.textContent = '00';
      return;
    }
    const sec = Math.floor(left / 1000);
    cells.d.textContent = pad(Math.floor(sec / 86400));
    cells.h.textContent = pad(Math.floor((sec % 86400) / 3600));
    cells.m.textContent = pad(Math.floor((sec % 3600) / 60));
    cells.s.textContent = pad(sec % 60);
    setTimeout(tick, 1000 - (Date.now() % 1000));
  };
  tick();
}
