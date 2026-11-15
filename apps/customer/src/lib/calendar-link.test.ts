import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsFor } from "./calendar-link";
import { shouldAskPush } from "./push-ask";
import { readFileSync } from "node:fs";

const b = { id: "bk1", scheduledDate: "2026-10-20", scheduledTime: "10:00", estimatedEndDate: "2026-10-20", estimatedEndTime: "13:30" };

describe("calendar link", () => {
  it("carries the studio time zone and the real span", () => {
    const u = new URL(googleCalendarUrl(b, "Foam wash"));
    expect(u.searchParams.get("dates")).toBe("20261020T100000/20261020T133000");
    expect(u.searchParams.get("ctz")).toBe("Asia/Kolkata");
    expect(u.searchParams.get("text")).toContain("Foam wash");
  });
  it("never produces an event that ends before it starts", () => {
    const u = new URL(googleCalendarUrl({ ...b, estimatedEndTime: "09:00" }, "Foam wash"));
    expect(u.searchParams.get("dates")).toBe("20261020T100000/20261020T110000");
  });
  it("ics has a zone, a stable id and escapes commas", () => {
    const ics = icsFor(b, "Foam wash", new Date("2026-10-16T00:00:00Z"));
    expect(ics).toContain("DTSTART;TZID=Asia/Kolkata:20261020T100000");
    expect(ics).toContain("UID:bk1@autodeck.in");
    expect(ics).toContain("Ellisbridge\\, Ahmedabad");
  });
});

describe("push ask", () => {
  it("asks once, and only when the browser can still be asked", () => {
    expect(shouldAskPush("prompt", false)).toBe(true);
    expect(shouldAskPush("prompt", true)).toBe(false);
    for (const p of ["on", "denied", "unavailable"] as const) expect(shouldAskPush(p, false)).toBe(false);
  });
});

describe("resilience", () => {
  it("the root shows an offline banner and wraps screens in an error boundary", () => {
    const s = readFileSync(`${__dirname}/../app/_layout.tsx`, "utf8");
    expect(s).toContain("<ConnectionBanner />");
    expect(s).toContain("<ErrorBoundary>");
  });
});
