import fs from 'node:fs';
// The home stylesheet is cached immutable for a year: its link must carry a content hash.
const html = fs.readFileSync('dist/index.html', 'utf8');
if (!/home\.css\?v=[0-9a-f]{10}/.test(html)) { console.error('css-version-guard FAIL: home.css link has no content hash'); process.exit(1); }
console.log('css-version ok');
