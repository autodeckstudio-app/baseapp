import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync(new URL("../src/pages/index.astro", import.meta.url), "utf8");

test("Home does not repeat the Open the app button inside the app story", () => {
  // Meet: repeated app buttons on the home page. One in the hero and one in the install card is enough.
  const links = home.match(/Open the app/g) ?? [];
  assert.ok(links.length <= 2, `Open the app appears ${links.length} times in index.astro`);
  const story = home.slice(home.indexOf('id="app"'), home.indexOf('class="app-install'));
  assert.doesNotMatch(story, /Open the app/);
});
