import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { repairText } from "./text-repair";

describe("repairText", () => {
  it("fixes the garbled rupee sign", () => {
    expect(repairText("payment of \u00e2\u0082\u00b9590.")).toBe("payment of \u20b9590.");
    expect(repairText("total \u00e2\u00b9590")).toBe("total \u20b9590");
  });
  it("leaves clean text alone", () => { expect(repairText("Paid \u20b9590 \u00b7 done")).toBe("Paid \u20b9590 \u00b7 done"); });
});

// Guardrail: no source file may contain text that was saved with the wrong encoding.
describe("source encoding", () => {
  const roots = ["../../../customer/src", "../../../studio/src", "../../../admin/src", "../../../site/src", "../../../../packages", "../../../../functions/src"];
  const bad = /[\u00c2\u00c3][\u0080-\u00bf\u00a0-\u00ff]|\u00e2[\u0080-\u00bf\u20ac]/;
  function walk(dir: string, out: string[]) {
    for (const n of readdirSync(dir)) {
      if (n === "node_modules" || n === "dist" || n === ".expo") continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.(ts|tsx|astro|json|md)$/.test(n) && !/text-repair/.test(n)) out.push(p);
    }
  }
  it("has no mojibake in app, package or function sources", () => {
    const files: string[] = [];
    for (const r of roots) { try { walk(join(__dirname, r), files); } catch { /* root missing */ } }
    // Comments in older files carry harmless garbled dashes; only text a person can see matters.
    const visible = (l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l);
    const hits = files.filter((f) => readFileSync(f, "utf8").split("\n").filter(visible).some((l) => bad.test(l.replace(/\s\/\/.*$/, ""))));
    expect(hits).toEqual([]);
  });
});
