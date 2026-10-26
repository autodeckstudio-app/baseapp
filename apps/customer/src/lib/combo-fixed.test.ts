import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { comboCards, comboFor } from "./booking-ideas";
const svc = (id: string, o: Record<string, unknown> = {}) => ({ id, name: id, active: true, priceOnRequest: false, description: "", ...o }) as never;
describe("combos are one fixed bundle (round7 p15)", () => {
  const catalogue = [svc("menu-wash-exterior", { description: "Foam wash. - Wheel clean. - Dry" }), svc("plain-wash")];
  it("the booking page and the Combos list use the same rule", () => {
    const ids = comboCards(catalogue).map((c) => c.service.id);
    expect(ids).toContain("menu-wash-exterior");
    for (const s of catalogue) expect(comboFor(catalogue, (s as { id: string }).id) !== null).toBe(ids.includes((s as { id: string }).id));
    expect(comboFor(catalogue, undefined)).toBeNull();
    expect(comboFor(catalogue, "plain-wash")).toBeNull();
  });
  it("a combo gets its contents as plain text; the booking page forces no extras for a combo", () => {
    expect(comboFor(catalogue, "menu-wash-exterior")?.parts.join(" ")).toContain("Foam wash");
    const src = readFileSync("src/app/(tabs)/book/[serviceId].tsx", "utf8");
    expect(src).toContain("const extraIds = combo ? [] : extraIdsState;");
    expect(src).toContain("{!combo && service.priceOnRequest !== true");
    expect(src).toContain("...(extraIds.length ? { extras: extrasToParam(extraIds) } : {})");
  });
});
