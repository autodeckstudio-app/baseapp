// Water drop must stay a narrow tapered drop at the original size, and the landing ripple must stay small (not a screen-size circle).
import fs from 'node:fs';
const css = fs.readFileSync('public/assets/v2/home.css', 'utf8');
const js = fs.readFileSync('src/scripts/home-v2-appr.ts', 'utf8');
const bad = [];
const dm = css.match(/\.drop::before\{[^}]*width:([\d.]+)vmin;height:([\d.]+)vmin[^}]*url\("data:image\/svg\+xml,([^"]*)"\)/);
if (!dm) bad.push('drop is not an SVG teardrop');
else {
  const svg = decodeURIComponent(dm[3]);
  if (+dm[1] > 11) bad.push('drop visual width above 11vmin');
  if (+dm[2] < 1.4 * +dm[1]) bad.push('drop is not tall and tapered (height under 1.4x width)');
  // a pointed tip at the top centre, curved sides, round base: the path starts at the tip and has no straight polygon edges
  if (!/<path[^>]* d="M50 2C/.test(svg) || /<polygon|<circle/.test(svg)) bad.push('drop outline is not a curved teardrop path from a top tip');
  if (!/<ellipse[^>]*fill="#fff"/.test(svg)) bad.push('drop has no specular highlight');
}
const r = js.match(/scale\(\$\{\.3\+ex\*([\d.]+)\}\)/);
if (!r || +r[1] > 1) bad.push('ripple scale growth above 1x');
if (bad.length) { console.error('drop-guard FAIL:', bad.join('; ')); process.exit(1); }
console.log('drop-guard ok');
