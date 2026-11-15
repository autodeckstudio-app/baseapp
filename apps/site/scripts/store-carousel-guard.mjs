// Regression: store carousel images must not be lazy. In a sideways auto-scrolling
// row, lazy images load late, so tiles at the end show empty dark space.
import { readFileSync } from "node:fs";
const h = readFileSync(new URL("../src/data/home-v2-body.html", import.meta.url), "utf8");
const i = h.indexOf('<div class="wall">'); const j = h.indexOf("</section>", i);
if (i < 0 || j < 0) { console.error("store-carousel-guard: wall not found"); process.exit(1); }
const imgs = h.slice(i, j).match(/<img\b[^>]*>/g) || [];
const bad = imgs.filter(t => /loading="lazy"/.test(t));
if (imgs.length < 10 || bad.length) { console.error(`store-carousel-guard: ${imgs.length} imgs, ${bad.length} lazy`); process.exit(1); }
console.log(`store-carousel-guard ok (${imgs.length} eager imgs)`);
