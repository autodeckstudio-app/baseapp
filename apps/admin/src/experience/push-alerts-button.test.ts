// Guard: the alerts corner button stays recognizable on phones, where the
// "Alerts" text is hidden by canvas.css (<=860px). It must carry a visible
// bell icon and an accessible label, never an empty circle.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./PushAlertsButton.tsx", import.meta.url), "utf8");

describe("push alerts corner button", () => {
  it("renders a visible bell icon, not text only", () => {
    expect(src).toContain('<Icon name="bell"');
  });
  it("keeps an accessible label", () => {
    expect(src).toMatch(/aria-label="Turn on message alerts"/);
  });
});
