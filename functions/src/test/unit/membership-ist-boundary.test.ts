import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { membershipDay } from "@autodeck/core";
import { membershipForFreePickup } from "../../lib/pickup-benefit.js";
import { sweepStaleMemberships } from "../../lib/expiry-sweeps.js";
import { hasPriorityMembership } from "../../lib/priority-hold.js";
afterEach(() => vi.useRealTimers());
const read = (p: string) => readFileSync(`${__dirname}/../../${p}`, "utf8");
describe("membership IST expiry consumers", () => {
  it.each([["2026-11-20T18:29:59.999Z", true], ["2026-11-20T18:30:00Z", false], ["2026-11-21T00:00:00Z", false]] as const)("pickup and priority eligibility at %s", (now, valid) => {
    const m = { id: "m", status: "active" as const, endDate: "2026-11-20", pickupsTotal: 1, pickupsUsed: 0, prioritySlot: true };
    expect(membershipForFreePickup([m], now) !== null).toBe(valid);
    expect(hasPriorityMembership([m], membershipDay(now))).toBe(valid);
  });
  it.each([["2026-11-20T18:29:59.999Z", "2026-11-20"], ["2026-11-20T18:30:00Z", "2026-11-21"], ["2026-11-21T00:00:00Z", "2026-11-21"]])("sweeper query uses IST day at %s without changing stored dates", async (now, day) => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(now));
    const where = vi.fn(); const get = vi.fn(async () => ({ empty: true }));
    const query = { where: (...args: unknown[]) => { where(...args); return query; }, get };
    const db = { collection: () => query };
    expect(await sweepStaleMemberships(db as never)).toEqual({expiredCount:0});
    expect(where).toHaveBeenCalledWith("endDate", "<", day);
  });
  it("sweep changes status/audit only and preserves purchased dates, counters and benefits", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-20T18:30:00Z"));
    const membership = Object.freeze({id:"old",tenantId:"t",status:"active",startDate:"2026-10-20",endDate:"2026-11-20",washesTotal:8,washesUsed:3});
    const updates: unknown[] = []; const audits: any[] = [];
    const query = {where: () => query,get:async()=>({empty:false,docs:[{id:"old",ref:{id:"old"},data:()=>membership}]})};
    const db = {collection:(name:string)=>name==="memberships"?query:{doc:()=>({id:"audit"})},batch:()=>({update:(_ref:unknown,v:unknown)=>updates.push(v),set:(_ref:unknown,v:any)=>audits.push(v),commit:async()=>{}})};
    expect(await sweepStaleMemberships(db as never)).toEqual({expiredCount:1});
    expect(updates).toEqual([{status:"expired",updatedAt:"2026-11-20T18:30:00.000Z"}]);
    expect(audits[0].before).toEqual({status:"active",endDate:"2026-11-20"});
    expect(membership.washesUsed).toBe(3);expect(membership.endDate).toBe("2026-11-20");
  });
  it("all activation paths use the same term helper, leaving duration unchanged", () => {
    for (const p of ["functions/membership/activateMembership.ts", "functions/membership/confirmMembershipPayment.ts", "functions/membership/createWalkinMembership.ts", "functions/payment/confirmPaymentMock.ts", "lib/razorpay-webhook.ts"])
      expect(read(p)).toContain("membershipTermDates(now, MEMBERSHIP_DURATION_DAYS)");
  });
  it("booking and refresh authorization use the shared day and scheduled dates stay calendar dates", () => {
    expect(read("functions/booking/createBooking.ts")).toContain("const todayStr = membershipDay(now)");
    expect(read("functions/booking/createBooking.ts")).toContain("membership.endDate < data.scheduledDate");
    expect(read("functions/membership/recordMembershipRefresh.ts")).toContain("const today = membershipDay()");
    expect(read("lib/membership-refund.ts")).toContain("data.endDate < membershipDay(now)");
  });
  it("schedules stale status cleanup at midnight IST, independent of lazy eligibility", () => {
    const src = read("functions/membership/expireStaleMembershipsScheduled.ts");
    expect(src).toContain('schedule: "0 0 * * *"'); expect(src).toContain('timeZone: "Asia/Kolkata"');
  });
});
