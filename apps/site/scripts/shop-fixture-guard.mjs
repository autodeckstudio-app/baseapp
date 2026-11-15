// A fixture product must never reach a production build.
import fs from 'node:fs';
const bad = [];
if (fs.existsSync('dist/shop/fixture-tee')) bad.push('dist/shop/fixture-tee exists');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]);
for (const f of walk('dist').filter(f => f.endsWith('.html'))) if (/FIXTURE/.test(fs.readFileSync(f, 'utf8'))) bad.push('FIXTURE text in ' + f);
if (bad.length) { console.error('shop-fixture-guard FAIL:', bad.join('; ')); process.exit(1); }
console.log('shop-fixture-guard ok');
