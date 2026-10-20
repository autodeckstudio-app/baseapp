import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/styles/studio.css", import.meta.url), "utf8");
const rules = [...css.matchAll(/([^{}]*\.phone-shell[^{}]*)\{([^}]*)\}/g)].map((m) => ({ sel: m[1].trim(), body: m[2] }));

test("the pinned app story phone is never clamped by its container width", () => {
  // Safari sizes the shrink-to-fit column from its content, so max-width:100% on the phone collapsed it to the dot row width
  // and cropped the app screenshot left and right. The phone's width must come from its height and aspect ratio only.
  const pinned = rules.filter((r) => r.sel.includes(".app-story-enhanced") && /--ph\s*:/.test(r.body));
  assert.ok(pinned.length >= 4, "every breakpoint sets the phone height through --ph");
  const main = pinned.find((r) => /height\s*:\s*var\(--ph\)/.test(r.body));
  assert.ok(main, "the phone height comes from --ph");
  assert.match(main.body, /width\s*:\s*calc\(var\(--ph\)\*390\/844\)/);
  assert.match(main.body, /max-width\s*:\s*none/);
  assert.match(main.body, /box-sizing\s*:\s*border-box/);
  for (const r of pinned) assert.doesNotMatch(r.body, /max-width\s*:\s*100%/);
  for (const r of pinned) assert.doesNotMatch(r.body, /(^|;)\s*height\s*:\s*(?!var)/);
});

test("the phone keeps the real screen proportions", () => {
  const base = rules.find((r) => r.sel === ".phone-shell" && r.body.includes("aspect-ratio"));
  assert.ok(base);
  assert.match(base.body, /aspect-ratio\s*:\s*390\s*\/\s*844/);
  assert.match(readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8"), /width="390" height="844"/);
});
