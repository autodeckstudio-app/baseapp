// Regression (28 Oct 2026): tesseract.js 7 reports an unreadable image twice - the recognize() promise rejects AND the
// worker's default errorHandler throws asynchronously (an uncaught exception). In a deployed function the second one can
// take the instance down instead of letting finalizeMyPaper fail closed to PENDING manual review.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { readPaperImage } from "../../lib/paper-ocr.js";

describe("readPaperImage", () => {
  it("rejects bad bytes and raises NO uncaught exception", async () => {
    const uncaught: string[] = [];
    const h = (e: unknown) => { uncaught.push(String(e)); };
    process.on("uncaughtException", h);
    try {
      await expect(readPaperImage(Buffer.from("not an image"))).rejects.toThrow();
      await new Promise((r) => setTimeout(r, 1500)); // the stray throw arrives after the rejection
    } finally { process.off("uncaughtException", h); }
    expect(uncaught).toEqual([]);
  }, 60000);
  it("still reads a genuine synthetic document (fixture is generated text, not a real document)", async () => {
    const r = await readPaperImage(readFileSync(resolve(__dirname, "../fixtures/synthetic-policy.png")));
    expect(r.confidence).toBeGreaterThanOrEqual(80);
    expect(r.text).toMatch(/MH12AB1234/);
  }, 60000);
});
