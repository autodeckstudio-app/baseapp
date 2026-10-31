import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
// The 5 app-screen mockups ship under immutable 1-year cache headers (vercel.json
// /assets/*). Every reference must carry the current content hash (?v=sha1-10) so a
// replaced asset busts device caches automatically, and the canvas must include the
// 59px status strip + 30px home-indicator safe area (390x933) behind the iOS overlay.
const screens=['home','bookings','garage-stories','buysell','profile'];
const hash=n=>createHash('sha1').update(fs.readFileSync(`public/assets/redesign/${n}.webp`)).digest('hex').slice(0,10);
const ref=n=>`/assets/redesign/${n}.webp?v=${hash(n)}`;
function webpSize(n){const b=fs.readFileSync(`public/assets/redesign/${n}.webp`);
  const fourcc=b.toString('ascii',12,16);
  if(fourcc==='VP8 '){return [b.readUInt16LE(26)&0x3fff,b.readUInt16LE(28)&0x3fff]}
  if(fourcc==='VP8L'){const b1=b[21],b2=b[22],b3=b[23],b4=b[24];return [1+(((b2&0x3f)<<8)|b1),1+(((b4&0xf)<<10)|(b3<<2)|((b2&0xc0)>>6))]}
  if(fourcc==='VP8X'){return [1+b.readUIntLE(24,3),1+b.readUIntLE(27,3)]}
  throw new Error('unknown webp encoding '+fourcc)}
for(const n of screens){const [w,h]=webpSize(n);assert(w===390&&h===933,`${n}.webp must be 390x933 (status/safe-area extended), got ${w}x${h}`)}
const home=fs.readFileSync('src/data/redesign/home.html','utf8');
const app=fs.readFileSync('src/data/redesign/app.html','utf8');
const ts=fs.readFileSync('src/scripts/redesign.ts','utf8');
assert(home.includes(ref('home')),'home.html initial screen must carry the current content hash');
assert(app.includes(ref('home')),'app.html initial screen must carry the current content hash');
for(const n of screens) assert(ts.includes(`${n}.webp?v=${hash(n)}`),`redesign.ts screens entry ${n} must carry the current content hash`);
const distHome=fs.readFileSync('dist/index.html','utf8');
const distApp=fs.readFileSync('dist/app/index.html','utf8');
assert(distHome.includes(ref('home')),'dist home must reference versioned home.webp');
assert(distApp.includes(ref('home')),'dist app walkthrough must reference versioned home.webp');
const css=fs.readFileSync('public/assets/redesign/site.css','utf8');
for(const marker of ['aspect-ratio:390/933','.phone-island','.phone-home','.phone-statusbar']) assert(css.includes(marker),`site.css lost ${marker}`);
for(const marker of ['phone-island','phone-home','phone-statusbar']) {assert(home.includes(marker),`home.html lost ${marker}`);assert(app.includes(marker),`app.html lost ${marker}`)}
// tagline punctuation: no trailing period on "All under one roof"
assert(!home.includes('one roof.</span>'),'home hero tagline lost its punctuation fix');
// hero film ships under the same immutable /assets/* headers: its reference must
// carry the current content hash so a replaced film busts device caches.
const heroHash=createHash('sha1').update(fs.readFileSync('public/assets/redesign/hero-motion.webp')).digest('hex').slice(0,10);
const heroRef=`/assets/redesign/hero-motion.webp?v=${heroHash}`;
assert(home.includes(heroRef),'home.html hero film must carry the current content hash');
assert(distHome.includes(heroRef),'dist home hero film must carry the current content hash');
console.log('mockup asset version + frame guard passed');
