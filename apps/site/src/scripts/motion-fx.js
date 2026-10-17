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

  /* hero headline: masked line-by-line rise, once, after the intro beat */
  const h1 = document.querySelector('.hero2 h1');
  if (h1) {
    const delay = document.querySelector('[data-intro]') ? 1.5 : 0.25;
    const split = new SplitText(h1, { type: 'lines', linesClass: 'fx-line' });
    split.lines.forEach((line) => {
      const mask = document.createElement('span');
      mask.className = 'fx-mask';
      line.parentNode.insertBefore(mask, line);
      mask.appendChild(line);
    });
    gsap.set(split.lines, { yPercent: 110 });
    gsap.to(split.lines, {
      yPercent: 0,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.12,
      delay,
      onComplete: () => split.revert(),
    });
    /* safety: if the tween never finishes (throttled tab, script error), show the headline anyway */
    setTimeout(() => { gsap.killTweensOf(split.lines); split.revert(); }, (delay + 4) * 1000);
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
