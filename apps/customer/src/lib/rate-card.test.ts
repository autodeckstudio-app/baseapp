import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { rateCandidate } from "./rate-card";
import { invoiceShareText, whatsappShareUrl } from "./invoice-share";
import { GOOGLE_REVIEW_URL } from "./studio-info";

const day = 86400000;
const now = Date.parse("2026-10-20T12:00:00Z");
const b = (id: string, ago: number, status = "COMPLETED") => ({ id, status, serviceId: "s", scheduledAt: new Date(now - ago * day).toISOString() });

describe("rate card", () => {
  it("offers the newest visit finished in the last 7 days", () => {
    expect(rateCandidate([b("old", 9), b("new", 2), b("mid", 5)], now)?.id).toBe("new");
  });
  it("offers nothing for old, cancelled or future visits", () => {
    expect(rateCandidate([b("old", 8), b("c", 1, "CANCELLED"), b("fut", -3)], now)).toBeNull();
  });
  it("the Google review button is a real g.page review link or empty (hidden) and is never gated by the score", () => {
    expect(GOOGLE_REVIEW_URL).toMatch(/^https:\/\/g\.page\/r\/.+\/review$|^$/);
    const c = readFileSync(`${__dirname}/../ui/RateCard.tsx`, "utf8");
    expect(c).toContain("GOOGLE_REVIEW_URL ?");
    expect(c).not.toMatch(/stars?\s*(>=|>|<)/);
  });
});

describe("invoice share", () => {
  it("carries the number, total and studio phone", () => {
    const t = invoiceShareText({ number: "INV-2026-00001", totalPaise: 123450, studioName: "AutoDeck", studioPhone: "+919898679711" });
    expect(t).toContain("INV-2026-00001");
    expect(t).toContain("1,234.5");
    expect(whatsappShareUrl(t)).toContain("wa.me/?text=");
  });
});

describe("policy links", () => {
  it("are config values, hidden until set, and shown on sign-in, setup and You", () => {
    const si = readFileSync(`${__dirname}/studio-info.ts`, "utf8");
    expect(si).toContain('export const PRIVACY_POLICY_URL = ""');
    expect(si).toContain('export const TERMS_URL = ""');
    for (const f of ["ui/LoginStage.tsx", "app/(auth)/setup.tsx", "app/(tabs)/profile.tsx"]) expect(readFileSync(`${__dirname}/../${f}`, "utf8")).toContain("<LegalLinks");
  });
});
