import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const read = (p: string) => readFileSync(p, "utf8");
describe("round7 points 1-2", () => {
  it("point 1: dropdown options carry explicit theme colours (dark list is dark with light text)", async () => {
    const src = read("src/ui/inputs.tsx");
    expect(src).toContain("optionStyleFor(day)");
    expect(src.match(/style:optStyle/g)?.length).toBe(2);
    expect(src).toContain("background: day ? '#FFFFFF' : '#1D1B26', color: day ? '#1D1B26' : '#F6F4F1'");
  });
  it("point 2: a trailing pill is pinned outside the horizontal scroller, and no trailing means the same scroller as before", () => {
    const src = read("src/ui/FilterPills.tsx");
    expect(src).toContain("trailing && !pinned ? trailing : null");
    expect(src).toContain("if (!pinned || !trailing) return row;");
    expect(src).toContain("flex: 1, minWidth: 0");
  });
  it("point 2: Garage keeps All fixed (only the car chips scroll); Services does not opt in, so it is unchanged", () => {
    const src = read("src/ui/FilterPills.tsx");
    expect(src).toContain("fixedFirst = false");
    expect(src).toContain("const scrolled = lockFirst ? items.slice(1) : items;");
    expect(src).toContain("{lockFirst ? pill(items[0]!) : null}");
    expect(read("src/app/(tabs)/garage/index.tsx")).toContain("<FilterPills fixedFirst items=");
    expect(read("src/app/(tabs)/catalogue/index.tsx")).not.toContain("fixedFirst");
  });
});
describe("round7 points 3-4", () => {
  it("point 4: registration input is upper-cased, space-free and capped at 10; stored plates are not rewritten", async () => {
    const { limitRegistrationInput } = await import("../lib/registration-input");
    expect(limitRegistrationInput("mh 02 ab 1234")).toBe("MH02AB1234");
    expect(limitRegistrationInput("gj01ab12345678")).toBe("GJ01AB1234");
    expect(limitRegistrationInput(" gj 01 \t ab 1234 ")).toBe("GJ01AB1234");
  });
  it("point 3: add-car no longer has the RC uploader or upload call; the service function stays", () => {
    const add = read("src/app/(tabs)/garage/add.tsx");
    expect(add).not.toContain("RC photo");
    expect(add).not.toContain("uploadVehicleRc");
    expect(add).toContain("limitRegistrationInput");
    expect(read("src/lib/vehicle-service.ts")).toContain("export async function uploadVehicleRc");
  });
});
describe("round7 points 5-12 (car page)", () => {
  const car = read("src/app/(tabs)/garage/[id].tsx");
  it("p11: booking and service sections come first, all document sections last", () => {
    const at = (t: string) => { const i = car.indexOf(t); expect(i, t).toBeGreaterThan(0); return i; };
    expect(at('title="Service due"')).toBeLessThan(at('title="Documents"'));
    expect(at("buildHistory(")).toBeLessThan(at('title="Documents"'));
    expect(at('title="Documents"')).toBeLessThan(at("<Kicker>Papers</Kicker>"));
    expect(at("<Kicker>Papers</Kicker>")).toBeLessThan(at("<Kicker>Warranty</Kicker>"));
  });
  it("p10: no separate Next due card or document-expiry reminders", () => {
    expect(car).toContain("const due = null;");
    expect(car).not.toContain("expired. Upload the renewed copy");
    expect(car).not.toContain("expires in ${left}");
  });
  it("p5/p6/p8/p12: edit and delete per row, delete confirm, RC edit-in-place, number error, OTHER name", () => {
    expect(car).toContain('kind="edit"'); expect(car).toContain('kind="delete"');
    expect(car).toContain("Delete this document?");
    expect(car).toContain("papers.find((x) => x.id === deleteId)"); // names the target in the confirm body
    expect(car).toContain("papers.find((p) => p.kind === \"RC\")");
    expect(car).toContain("numberClash(allPapers");
    expect(car).toContain('label="Document name" placeholder="e.g. Warranty card"');
  });
});
describe("round7 p4: paste of spaced RC text is normalised before the 10-char cap", () => {
  it("limitRegistrationInput strips spaces first, then caps at 10", async () => {
    const { limitRegistrationInput, REG_RAW_MAX } = await import("../lib/registration-input");
    expect(limitRegistrationInput("mh 12 cd 5678 99")).toBe("MH12CD5678");
    expect(limitRegistrationInput("gj 01-ab.12/34!")).toBe("GJ01-AB.12");
    expect(REG_RAW_MAX).toBeGreaterThan(16);
  });
  it("the RC and add-car inputs do not clip raw text at 10 natively", () => {
    const rc = read("src/app/(tabs)/garage/[id].tsx"); const add = read("src/app/(tabs)/garage/add.tsx");
    expect(rc).toContain('maxLength={docForm.kind==="RC"?REG_RAW_MAX:120}');
    expect(add).toContain('key === "registrationNumber" ? REG_RAW_MAX');
    expect(rc).not.toContain('docForm.kind==="RC"?10:120'); expect(add).not.toMatch(/registrationNumber" \? 10/);
  });
});
