import { describe, expect, it } from "vitest";
import { applyBrandWarranty } from "./warranty-labels";

const svc = (id: string, name: string, w: string | null = "x") => ({ id, name, warrantyLabel: w }) as unknown as Parameters<typeof applyBrandWarranty>[0];

describe("warranty labels are per film or product", () => {
  it("shows the sourced term for a named film", () => {
    expect(applyBrandWarranty(svc("a", "Garware Plus")).warrantyLabel).toBe("5-Year PPF Film Warranty");
    expect(applyBrandWarranty(svc("a", "LLumar Valor")).warrantyLabel).toBe("12-Year PPF Film Warranty");
    expect(applyBrandWarranty(svc("a", "Kovalent Borophene")).warrantyLabel).toContain("registration");
  });
  it("blanks Garware Platinum, AutoDeck Care, Fireball and 3M Ceramic", () => {
    for (const [id, name] of [["a", "Garware Platinum"], ["menu-coat-autodeck-1", "x"], ["menu-coat-fireball-2", "x"], ["menu-coat-3m-ceramic", "x"]] as [string, string][]) {
      expect(applyBrandWarranty(svc(id, name)).warrantyLabel).toBeNull();
    }
  });
  it("never applies one brand-wide term to brand and coverage cards", () => {
    expect(applyBrandWarranty(svc("menu-ppf-xpel-full-body", "XPEL Full body", "10-year film warranty")).warrantyLabel).toBeNull();
  });
});
