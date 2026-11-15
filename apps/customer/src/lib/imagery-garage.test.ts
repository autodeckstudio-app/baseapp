import { describe, it, expect } from "vitest";
import { topicOf, GARAGE_PHOTO_TOPICS } from "./imagery-topic";

const names: [string, string, string][] = [
  ["Multi-point inspection", "garage", "gInspect"], ["Wheel alignment and balancing", "garage", "align"],
  ["AC check", "garage", "ac"], ["Battery check", "garage", "battery"],
  ["Repairs and other work (book an inspection)", "garage", "repair"],
  ["Vinyl wraps and colour change", "mods", "wrap"], ["Accessories and styling", "mods", "styling"],
  ["Pickup and drop", "pickup", "pickup"],
];
describe("garage, mods and pickup imagery", () => {
  it("gives each menu service its own topic photo", () => {
    for (const [name, category, topic] of names) expect(topicOf({ name, category })).toBe(topic);
  });
  it("garage topics are the ones with photos", () => {
    for (const [, c, t] of names) if (c === "garage") expect(GARAGE_PHOTO_TOPICS).toContain(t);
  });
});
