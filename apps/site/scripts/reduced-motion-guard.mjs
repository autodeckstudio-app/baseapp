// Reduced motion must be a real, readable page: the stacked story exists with all five frames, normal mode hides it, and RM hides the pinned journey.
import fs from "node:fs";
const body = fs.readFileSync("src/data/home-v2-body.html", "utf8");
const css = fs.readFileSync("public/assets/v2/home.css", "utf8");
const fail = (m) => { console.error("reduced-motion-guard: " + m); process.exit(1); };
if (!/id="rmstory"/.test(body)) fail("missing #rmstory");
if ((body.match(/class="rmp"/g) || []).length !== 5) fail("expected 5 story panels");
for (const w of ["Bring it", "Clean.", "Look", "Swirls out.", "Keys back."]) if (!body.includes(w)) fail("missing copy: " + w);
if (!/\.rmstory\{display:none\}/.test(css)) fail("normal mode must hide .rmstory");
if (!/@media\(prefers-reduced-motion:reduce\)\{\s*#journey\{display:none\}/.test(css)) fail("reduced motion must hide the pinned #journey");
if (!/\.gh\{opacity:1;pointer-events:auto;transform:none\}/.test(css)) fail("header must be visible in reduced motion");
console.log("reduced-motion-guard ok");
