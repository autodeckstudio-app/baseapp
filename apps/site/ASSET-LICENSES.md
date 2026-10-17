# Third-party asset licences (apps/site)

| Asset | Source | Licence | Notes |
|---|---|---|---|
| `public/assets/models/car.glb` (Kenney "Car Kit" 3.1, `sedan-sports`) | https://kenney.nl/assets/car-kit (zip: https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip) | CC0 1.0 (public domain), commercial use allowed, credit optional | External `Textures/colormap.png` intentionally unused; materials recoloured in `src/scripts/hero-car.js` to brand (gloss black, orange accent). |
| three.js (npm `three`) | https://github.com/mrdoob/three.js | MIT | Lazy-loaded on the home hero only. |
| GSAP (npm `gsap`, incl. ScrollTrigger/SplitText) | https://gsap.com/community/standard-license/ | GSAP Standard License, free for commercial use since 2025-04-30 (Webflow) | Reserved for scroll scenes; keep lazy. |
| Taste Skill (design review only, no code shipped) | https://github.com/Leonxlnx/taste-skill | MIT | Used as an art-direction checklist during the build. |
| ThreeUI Community components (reference, no code shipped yet) | https://github.com/MengTo/threeui | MIT (Community tier only; PRO excluded) | If a component is copied, add it here. |

## Poly Haven covered_car (hero 3D model)

- Source: https://polyhaven.com/a/covered_car
- Licence: CC0 (public domain), https://polyhaven.com/license
- Files: public/assets/models/covered-car/ (gltf 1k: covered_car.gltf, covered_car.bin, textures/)
- Use: hero 3D turntable on the home page. No attribution required.
