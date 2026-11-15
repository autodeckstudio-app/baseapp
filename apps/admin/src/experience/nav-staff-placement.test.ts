import { describe, expect, it } from "vitest";
import { SECTIONS, GROUPS, MORE_LINKS } from "./nav";

// Basket item 1 (2 Nov): Admin "Staff" sits beside Customers, with
// name/email/contact. The page itself collects name + Google account +
// optional contact number; adding the email alone grants Studio login,
// independent of any Aadhaar tick.
describe("Admin nav places Staff beside Customers", () => {
  const peopleSection = SECTIONS.find((s) => s.key === "people")!;
  const peopleGroup = GROUPS.find((g) => g.key === "people")!;

  it("sidebar People section: Staff immediately after Customers, once", () => {
    const hrefs = peopleSection.links.map((l) => l.href);
    expect(hrefs.filter((h) => h === "/staff")).toHaveLength(1);
    expect(hrefs.indexOf("/staff")).toBe(hrefs.indexOf("/customers") + 1);
    expect(peopleSection.links.find((l) => l.href === "/staff")?.label).toBe("Staff");
  });

  it("phone People group: Staff immediately after Customers", () => {
    const hrefs = peopleGroup.links.map((l) => l.href);
    expect(hrefs.indexOf("/staff")).toBe(hrefs.indexOf("/customers") + 1);
  });

  it("Staff appears exactly once across sidebar sections and not in the More sheet", () => {
    const all = SECTIONS.flatMap((s) => s.links.map((l) => l.href));
    expect(all.filter((h) => h === "/staff")).toHaveLength(1);
    expect((MORE_LINKS as readonly { href: string }[]).some((l) => l.href === "/staff")).toBe(false);
  });
});
