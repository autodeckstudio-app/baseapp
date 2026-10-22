// Water drop must stay a narrow tapered drop at the original size, and the landing ripple must stay small (not a screen-size circle).
import fs from 'node:fs';
const css = fs.readFileSync('public/assets/v2/home.css', 'utf8');
const js = fs.readFileSync('src/scripts/home-v2-appr.ts', 'utf8');
const bad = [];
if (!/\.drop::before\{[^}]*border-radius:0 50% 50% 50%[^}]*transform:scale\(\.\d+,1\.\d+\) rotate\(-45deg\)/.test(css)) bad.push('drop is not a narrow tapered drop');
const m = css.match(/\.drop::before\{[^}]*width:([\d.]+)vmin/);
if (!m || +m[1] > 11) bad.push('drop visual width above 11vmin');
const r = js.match(/scale\(\$\{\.3\+ex\*([\d.]+)\}\)/);
if (!r || +r[1] > 1) bad.push('ripple scale growth above 1x');
if (bad.length) { console.error('drop-guard FAIL:', bad.join('; ')); process.exit(1); }
console.log('drop-guard ok');
