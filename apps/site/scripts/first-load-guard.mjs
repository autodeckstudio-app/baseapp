// The wash (dirty to clean slide) must not play until the dirty and clean frames are loaded, otherwise a fast scroll on a slow connection slides past an empty stage.
import fs from 'node:fs';
const js = fs.readFileSync('src/scripts/home-v2-appr.ts', 'utf8');
const bad = [];
if (!/const cleanReady=\(\)=>ok\(L\.c\)&&ok\(L\.d\)/.test(js) || !/const ok=i=>i\.complete&&i\.naturalWidth>0/.test(js)) bad.push('no loaded-frames check');
if (!/P>\.035&&!ready&&!failed\(L\.c\)&&!failed\(L\.d\)\)\{P=\.035/.test(js)) bad.push('wash progress is not held until frames are loaded (released only when loaded or failed)');
if (/now-T0|8000/.test(js)) bad.push('a timeout must not reveal an unloaded stage');
if (!/now<pace&&PS<\.22&&P>PS\)PS=Math\.min\(P,PS\+dt\*\.12\)/.test(js)) bad.push('release after loading is not paced (the wash would snap)');
if (/history\.scrollRestoration\s*=/.test(js)) bad.push('scroll restoration must not be changed (it breaks back/deep-link positions)');
if (/sweepEl\.style\.left/.test(js)) bad.push('the wash line must move by transform, not left (left forces layout every frame)');
if (!/\.sdet\{min-height:\d+px\}/.test(fs.readFileSync('public/assets/v2/home.css', 'utf8'))) bad.push('service description block has no reserved height (the services panel jumps as text length changes)');
if (bad.length) { console.error('first-load-guard FAIL:', bad.join('; ')); process.exit(1); }
console.log('first-load-guard ok');
