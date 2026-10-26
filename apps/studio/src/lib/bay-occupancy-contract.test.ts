import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The walk-in screen and the bay board must use the one shared rule, so a no-show frees its bay the same way on both.
const read = (p: string) => readFileSync(`${__dirname}/../${p}`, "utf8");
describe("bay occupancy uses the shared rule", () => {
  for (const f of ["app/(tabs)/walkin.tsx", "app/(tabs)/bays.tsx"]) {
    it(f, () => { const s = read(f); expect(s).toContain("jobHoldsBay"); expect(s).not.toContain("ACTIVE_STATUSES"); });
  }
});

describe("cancelled jobs take no payment", () => {
  it("the job page hides Record cash payment once a job is cancelled", () => {
    const s = read("app/(tabs)/jobs/[id].tsx");
    expect(s).toMatch(/!payment && job\.status !== "CANCELLED" && \(\s*<Button\s+label=(?:"Record cash payment"|\{UPI_RECORD_ENABLED \? "Record payment" : "Record cash payment"\})/);
  });
  it("the server already refuses payment on a cancelled job", () => {
    const f = (n: string) => readFileSync(`${__dirname}/../../../../functions/src/functions/payment/${n}.ts`, "utf8");
    for (const n of ["recordManualPayment", "initiatePayment", "confirmManualPayment"]) expect(f(n)).toContain('job.status === "CANCELLED"');
  });
});
