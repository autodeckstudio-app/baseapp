import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guard: the merged Home (concept B base). One book button, one car chip row, no duplicate blocks.
const src = readFileSync(join(__dirname, "HomeView.tsx"), "utf8");
const body = src.slice(src.indexOf("export function HomeView"));
const at = (needle: string) => body.indexOf(needle);

describe("merged Home", () => {
  it("renders blocks in the agreed order, each once", () => {
    const order = ["<LeadCard", "{liveOn ? <LiveCard", 'title="Services for you"', '<Heading title="Club"', "<CarsCard", 'accessibilityLabel="Open the studio page"'];
    const pos = order.map(at);
    expect(pos.every((x) => x > 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
    for (const o of order) expect(body.split(o).length - 1).toBe(1);
  });
  it("has no big car hero, stat tiles or second book button", () => {
    expect(body).not.toContain("<HeroStage");
    expect(body).not.toContain("<GarageCarousel");
    expect(body.split("onPress={p.onBook}").length - 1).toBeLessThanOrEqual(1);
  });
  it("slot 1 is the live card OR the car chip, never both", () => {
    expect(body).toMatch(/liveOn \? <LiveCard[^\n]*: <CarChips/);
  });
  it("the lead card is live job OR next step, never both", () => {
    expect(body.split("<LeadCard").length - 1).toBe(1);
  });
});
