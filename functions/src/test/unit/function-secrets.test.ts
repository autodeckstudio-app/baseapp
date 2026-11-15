// Guardrail: a function that reads a secret (directly, or through the payment provider)
// must bind it in `secrets`, otherwise it works locally and fails with INTERNAL in prod.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "../../functions");
const files: string[] = [];
(function walk(d: string) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && files.push(p); } })(root);

describe("function secret bindings", () => {
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (!/onCall\(|onRequest\(/.test(src)) continue;
    const bound = [...(/secrets:\s*\[([^\]]*)\]/.exec(src)?.[1] ?? "").matchAll(/"([A-Z0-9_]+)"/g)].map((m) => m[1]!);
    const needs = new Set<string>();
    for (const m of src.matchAll(/process\.env\[\s*"([A-Z0-9_]+(?:SECRET|KEY))"\s*\]/g)) needs.add(m[1]!);
    if (/getPaymentProvider\(/.test(src)) { needs.add("RAZORPAY_KEY_ID"); needs.add("RAZORPAY_KEY_SECRET"); }
    for (const n of needs) it(`${f.slice(root.length + 1)} binds ${n}`, () => expect(bound).toContain(n));
  }
});
