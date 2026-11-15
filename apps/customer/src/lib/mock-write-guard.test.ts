import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { formatStudioLocal } from "./booking-rules";

const r = (p: string) => readFileSync(`${__dirname}/../../${p}`, "utf8");

// The mock-sample booking route (?mock=1/2) can run in a browser with a persisted
// Firebase session: every write and every navigation into a write flow must be
// blocked explicitly, never relying on fake ids failing at the backend.
describe("mock sample route neutralizes writes explicitly", () => {
  const src = r("src/app/(tabs)/bookings/[id].tsx");
  it("mock mode is exactly mock=1/2 and dev-gated", () => {
    expect(src).toContain('const isMock = __DEV__ && !!devSample && (mock === "1" || mock === "2");');
  });
  it("every callable handler bails through mockWriteBlocked first", () => {
    for (const fn of ["handleRate", "handleDecide", "handleApproveQuote", "handlePayNow", "handleCancelConfirmed"]) {
      const start = src.indexOf(`function ${fn}(`);
      expect(start, fn).toBeGreaterThan(-1);
      expect(src.slice(start, start + 200), fn).toContain("if (mockWriteBlocked()) return;");
    }
  });
  it("no unguarded reschedule or book-again navigation and no PickupCard in mock", () => {
    expect(src).not.toMatch(/onPress=\{\(\) => router\.push\(\{ pathname: "\/\(tabs\)\/bookings\/reschedule"/);
    expect(src).not.toMatch(/onPress=\{\(\) => router\.push\(`\/\(tabs\)\/book\//);
    expect(src).toContain("!isMock && !walkIn");
    // the cancel affordance itself is hidden, not just handler-guarded
    expect(src).toContain('!isMock ? <Button label="Cancel booking"');
  });
  it("the signed-out dev bypass in _layout stays __DEV__-gated and mock-scoped", () => {
    const guard = r("src/ui/NavigationGuard.tsx");
    expect(guard).toMatch(/const devMockPreview =\s*__DEV__ &&\s*\(segs\[1\] === "garage" \|\| segs\[1\] === "bookings"\) &&\s*\/\[\?&\]mock=\//);
    expect(guard).toContain("!devMockPreview");
  });
});

describe("formatStudioLocal (non-IST device safety)", () => {
  // Tests run under TZ=UTC: a bare device-local parse of "14:00" would display
  // 7:30 pm in IST; the offset-pinned parse must show the studio wall time.
  it("shows the studio wall time, not a device-reinterpreted instant", () => {
    expect(formatStudioLocal("2026-11-06", "14:00")).toBe("Friday, 6 November at 2:00 pm");
  });
  it("pins the IST instant exactly", () => {
    expect(formatStudioLocal("2026-11-06", "09:00")).toContain("9:00 am");
  });
});
