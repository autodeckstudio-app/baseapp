import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("Home studio, club and follow groups", () => {
  const v = read("ui/HomeScene.tsx");
  it("keeps studio hours and contacts in a quiet unframed close", () => {
    expect(v).toContain('The studio, ${p.studio.hours}');
    expect(v).toContain('Open the studio page');
    expect(v).toContain('p.quick?.map');
    expect(v).toContain('p.social?.map');
    expect(v).not.toContain('sceneImagery.studio');
    expect(v).not.toContain('Follow us');
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

it("home studio card omits address only, canonical help/directions source remains",()=>{const home=read("ui/HomeScene.tsx");expect(home).not.toContain("{p.studio.address}");expect(home).toContain("p.studio.hours");expect(home).toContain("onPress={q.onPress}");});
