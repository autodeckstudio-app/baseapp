import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
const src = (f: string) => readFileSync(join(__dirname, f), "utf8");
describe("job duration display (studio)", () => {
  it("the job sheet formats sub-24h durations with the shared formatDuration, never raw minutes", () => {
    const job = src("../app/(tabs)/jobs/[id].tsx");
    expect(job).not.toContain("`${job.estimatedDurationMinutes} min`");
    expect(job).toContain("formatDuration(job.estimatedDurationMinutes)");
  });
});
