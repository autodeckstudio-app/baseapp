import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { searchFaq } from "./faq-search";
import { FAQ } from "./studio-info";

describe("help search (no model)", () => {
  it("empty query keeps the written order", () => { expect(searchFaq(FAQ, "  ")).toEqual(FAQ); });
  it("finds the cancellation answer from a loose phrase", () => {
    expect(searchFaq(FAQ, "cancelling my booking")[0]!.q).toMatch(/change or cancel/i);
  });
  it("finds invoice and warranty", () => { expect(searchFaq(FAQ, "warranty")[0]!.q).toMatch(/invoice and warranty/i); });
  it("returns nothing for unrelated text, so the call button shows", () => { expect(searchFaq(FAQ, "zzzz qqqq")).toEqual([]); });
  it("Help only searches the written FAQ: no network, no storing of what is typed", () => {
    const src = readFileSync(`${__dirname}/../app/(tabs)/help.tsx`, "utf8");
    expect(src).toContain("searchFaq(");
    expect(src).not.toMatch(/fetch\(|httpsCallable|AsyncStorage|localStorage/);
  });
});
