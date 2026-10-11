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
