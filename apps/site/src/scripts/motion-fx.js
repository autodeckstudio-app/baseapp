import Lenis from 'lenis';
import gsap from 'gsap';
import { SplitText } from 'gsap/SplitText';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/* Motion polish: smooth scroll and a staggered hero type reveal.
   Loaded lazily by main.js, never under prefers-reduced-motion. */
export function initMotionFx() {
  /* smooth wheel/trackpad scroll; native scroll position stays the source of
     truth, so the existing scroll choreography keeps working */
  const lenis = new Lenis({ autoRaf: true, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);

  /* masked line-by-line rise; reverts to plain markup when done */
  const riseLines = (el, opts = {}, safetyMs = 0) => {
    const split = new SplitText(el, { type: 'lines', linesClass: 'fx-line' });
    split.lines.forEach((line) => {
      const mask = document.createElement('span');
      mask.className = 'fx-mask';
      line.parentNode.insertBefore(mask, line);
      mask.appendChild(line);
    });
    gsap.set(split.lines, { yPercent: 110 });
    const tween = gsap.to(split.lines, {
      yPercent: 0,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.12,
      ...opts,
      onComplete: () => split.revert(),
    });
    /* the headline must never stay hidden: force the reveal done if it stalls */
    if (safetyMs) setTimeout(() => { if (tween.progress() < 1) tween.progress(1); }, safetyMs);
  };

  /* hero headline: rises once, after the intro beat */
  const h1 = document.querySelector('.hero2 h1');
  if (h1) riseLines(h1, { delay: document.querySelector('[data-intro]') ? 1.5 : 0.25 }, 4500);

  /* closing CTA headline rises when it enters */
  const ctaH = document.querySelector('.cta h2');
  if (ctaH) riseLines(ctaH, { scrollTrigger: { trigger: ctaH, start: 'top 84%', once: true } });

  /* hero drifts up and quietens as you scroll away */
  const hero = document.querySelector('.hero2');
  if (hero) {
    const heroWrap = hero.querySelector('.wrap');
    gsap.to(heroWrap, { y: -70, opacity: 0.12, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom 35%', scrub: 0.5 } });
    const carHost = hero.querySelector('[data-hero-car]');
    if (carHost) gsap.to(carHost, { y: 70, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: 0.5 } });
  }

  /* studio film: the page scrolls, the floor pans sideways */
  const film = document.querySelector('[data-film]');
  const track = film && film.querySelector('[data-film-track]');
  if (film && track) {
    film.classList.add('film-on');
    const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
    gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: film,
        start: 'top top',
        end: () => '+=' + (dist() + window.innerHeight * 0.25),
        pin: true,
        scrub: 0.6,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (st) => film.style.setProperty('--fp', String(st.progress)),
      },
    });
  }

  /* record timeline: the orange line draws itself with scroll */
  const tline = document.querySelector('[data-tline]');
  if (tline) {
    gsap.fromTo(tline, { '--tlp': 0 }, { '--tlp': 1, ease: 'none',
      scrollTrigger: { trigger: tline, start: 'top 82%', end: 'bottom 55%', scrub: 0.4 } });
  }

  /* chapter big-number and heading drift while the story is pinned */
  const pin = document.querySelector('[data-pin]');
  const num = document.querySelector('[data-num]');
  if (pin && num) {
    gsap.to(num, {
      yPercent: -18,
      ease: 'none',
      scrollTrigger: { trigger: pin, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
    });
  }

  return { destroy: () => lenis.destroy() };
}
