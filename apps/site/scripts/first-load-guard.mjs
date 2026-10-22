// The wash (dirty to clean slide) must not play until the dirty and clean frames are loaded, otherwise a fast scroll on a slow connection slides past an empty stage.
import fs from 'node:fs';
const js = fs.readFileSync('src/scripts/home-v2-appr.ts', 'utf8');
const bad = [];
if (!/const cleanReady=\(\)=>L\.c\.complete&&L\.c\.naturalWidth>0&&L\.d\.complete&&L\.d\.naturalWidth>0/.test(js)) bad.push('no loaded-frames check');
if (!/P>\.035&&now-T0<8000&&!\(cleanReady\(\)/.test(js)) bad.push('wash progress is not held until frames are loaded (with an 8 s release)');
if (/history\.scrollRestoration\s*=/.test(js)) bad.push('scroll restoration must not be changed (it breaks back/deep-link positions)');
if (bad.length) { console.error('first-load-guard FAIL:', bad.join('; ')); process.exit(1); }
console.log('first-load-guard ok');
