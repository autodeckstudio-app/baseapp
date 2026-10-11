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

// Immersive layer: drifting aurora follows the scroll, glass cards catch the pointer, and the hero job card keeps updating.
const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!calm) {
  const au = document.querySelector('.aurora');
  let ticking = false;
  addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => { au && au.style.setProperty('--sy', String(scrollY)); ticking = false; });
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    const g = e.target.closest && e.target.closest('.card,.bgroup,.cta-box,.trust .wrap>div,.frame,.chips a');
    if (!g) return;
    const r = g.getBoundingClientRect();
    g.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    g.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
}
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
