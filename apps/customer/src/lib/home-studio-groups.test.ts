import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("Home studio, club and follow groups", () => {
  const v = read("ui/HomeView.tsx");
  it("is three groups, with quick actions inside the studio card and no separate row", () => {
    for (const h of ['title="The studio"', 'title="Club"', 'title="Follow us"']) expect(v).toContain(h);
    expect(v).not.toContain('title="Studio and club"');
    expect(v.match(/p\.quick\?\.length/g)?.length).toBe(1);
  });
  it("call, WhatsApp, Instagram, channel and directions each have their own icon", () => {
    const art = read("ui/NavIcon.tsx");
    const bodies = ["call", "whatsapp", "instagram", "channel", "directions"].map((n) => art.match(new RegExp(`\\n  ${n}: \\{ body: '([^']*)'`))?.[1]);
    expect(bodies.every(Boolean)).toBe(true);
    expect(new Set(bodies).size).toBe(5);
    const h = read("app/(tabs)/index.tsx");
    expect(h).toContain('icon: "instagram"');
    expect(h).toContain('icon: "call"');
    expect(h).toContain('icon: "whatsapp"');
  });
  it("legacy phone name maps to call, not the chat bubble", () => expect(read("ui/NavIcon.tsx")).toContain('name === "phone") return "call"'));
});
