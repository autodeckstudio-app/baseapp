document.documentElement.classList.add('js');
// Reveal on scroll and the opening countdown. Nothing else.
const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
document.querySelectorAll('.rv').forEach((el) => io.observe(el));
const cd = document.getElementById('countdown');
if (cd) {
  const target = new Date(cd.dataset.target || '').getTime();
  const q = (k) => cd.querySelector(`[data-cd="${k}"]`);
  const pad = (n) => String(n).padStart(2, '0');
  const tick = () => {
    const ms = Math.max(0, target - Date.now());
    q('d').textContent = pad(Math.floor(ms / 864e5));
    q('h').textContent = pad(Math.floor(ms / 36e5) % 24);
    q('m').textContent = pad(Math.floor(ms / 6e4) % 60);
    q('s').textContent = pad(Math.floor(ms / 1e3) % 60);
  };
  tick(); setInterval(tick, 1000);
}

// Scroll-driven story: one background that changes with the page, a pinned chapter stage, a timeline that lights up, counters.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const bg = document.querySelector('.stage-bg');
const layers = bg ? [...bg.querySelectorAll('i')] : [];
const secs = [...document.querySelectorAll('[data-bg]')];
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const chaps = [...document.querySelectorAll('[data-chap]')], shots = [...document.querySelectorAll('[data-shot]')];
const stns = [...document.querySelectorAll('[data-stn]')];
const num = document.querySelector('[data-num]'), tag = document.querySelector('[data-tag]'), pin = document.querySelector('[data-pin]');
const tl = [...document.querySelectorAll('[data-tline] li')];
const kinds = ['Paint Protection Film', 'Detailing and Ceramic', 'Wash Studio', 'Performance Garage'];
let cur = -1, cc = -1;
function frame() {
  const y = scrollY, h = innerHeight;
  const total = Math.max(1, document.documentElement.scrollHeight - h);
  bg && bg.style.setProperty('--p', String(clamp(y / total)));
  bg && bg.style.setProperty('--gx', String(Math.sin(y / 600) * 18));
  // background follows the section nearest the middle of the screen
  let best = null, bd = 1e9;
  secs.forEach((s) => { const r = s.getBoundingClientRect(); const d = Math.abs(r.top + Math.min(r.height, h) / 2 - h / 2); if (r.bottom > 0 && r.top < h && d < bd) { bd = d; best = s; } });
  if (best) { const k = Number(best.dataset.bg); if (k !== cur) { cur = k; layers.forEach((l, i) => l.classList.toggle('on', i === k)); } }
  if (pin) {
    const r = pin.getBoundingClientRect();
    const p = clamp(-r.top / Math.max(1, r.height - h));
    pin.style.setProperty('--pp', String(p));
    const c = Math.min(chaps.length - 1, Math.floor(p * chaps.length));
    if (c !== cc) { cc = c; chaps.forEach((e, i) => e.classList.toggle('on', i === c)); shots.forEach((e, i) => e.classList.toggle('on', i === c)); stns.forEach((e, i) => e.classList.toggle('on', i <= c)); if (num) num.textContent = String(c + 1).padStart(2, '0'); if (tag) tag.textContent = kinds[c]; }
  }
  if (tl.length) { const r = tl[0].parentElement.getBoundingClientRect(); const p = clamp((h * 0.85 - r.top) / (r.height + h * 0.3)); const n = Math.round(p * tl.length); tl.forEach((e, i) => e.classList.toggle('on', i < n)); }
}
if (!calm) { addEventListener('scroll', () => requestAnimationFrame(frame), { passive: true }); addEventListener('resize', frame); }
frame();
document.querySelectorAll('[data-count]').forEach((el) => {
  const to = Number(el.dataset.count); let done = false;
  new IntersectionObserver((es, o) => es.forEach((e) => { if (e.isIntersecting && !done) { done = true; o.disconnect(); const t0 = performance.now(); const run = (t) => { const k = clamp((t - t0) / 1400); el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(run); }; requestAnimationFrame(run); } }), { threshold: 0.4 }).observe(el);
});
const steps = [
  ['Vehicle received', '09:12 am'], ['Photos taken at the bay', '09:20 am'], ['Paint correction in progress', '11:05 am'],
  ['Coating cured, final check', '04:40 pm'], ['Ready for handover', '06:15 pm'],
];
const line = document.getElementById('live-line'), when = document.getElementById('live-time');
if (line && when) {
  let i = 0;
  setInterval(() => {
    i = (i + 1) % steps.length;
    line.classList.add('swap'); when.classList.add('swap');
    setTimeout(() => { line.textContent = steps[i][0]; when.textContent = steps[i][1]; line.classList.remove('swap'); when.classList.remove('swap'); }, 260);
  }, 3200);
}
if (location.hash === '#all') document.querySelectorAll('.rv').forEach((e) => e.classList.add('in'));
{ const y0 = new URLSearchParams(location.search).get('y'); if (y0) { scrollTo(0, Number(y0)); frame(); } }
