// Guard: on phones the fixed bottom tab bar must never cover final content
// at maximum scroll. The phone tab-bar block in canvas.css pads the main
// scroller; keep that padding comfortably taller than the bar itself
// (bar: 64px + 10px offset = 74px + safe area).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./canvas.css", import.meta.url), "utf8");

describe("phone tab bar clearance", () => {
  it("pads the main scroller at least 96px plus safe area", () => {
    const m = css.match(/Phone tab bar[\s\S]*?\.ax-shell-frame > \.ax-main \{ padding-bottom: calc\((\d+)px \+ env\(safe-area-inset-bottom\)\)/);
    expect(m, "phone tab-bar padding rule not found").toBeTruthy();
    expect(Number(m![1])).toBeGreaterThanOrEqual(96);
  });
});
