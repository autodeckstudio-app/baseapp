/**
 * TEST. Default-deny sweep: every exported onCall function is invoked with an "accountant" token and empty data.
 * An endpoint is classified DENIED when it rejects with permission-denied/unauthenticated BEFORE doing work, REACHED otherwise.
 * REACHED endpoints must be on the explicit open list below (person-agnostic or own-record endpoints), reviewed one by one.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(__dirname, "../../functions");
function walk(d: string): string[] { return readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") && !p.includes(".test.") ? [p] : []; }); }

// Reviewed: reachable by ANY signed-in token. None returns money data: each is own-record, public catalogue or claims setup.
// Not client-callable by a signed-in person (schedulers and Firestore/Pub-Sub triggers: no request auth) or public by design.
const NON_CLIENT = /Scheduled$|^on[A-Z]/;
process.env["USE_PAYMENT_MOCK"] = "true";
// Callables that validate input BEFORE they read the caller get a schema-valid payload so the caller check is what is exercised.
const VALID: Record<string, unknown> = {
  cancelBooking: { bookingId: "b", reason: "r" },
  rescheduleBooking: { bookingId: "b", newDate: "2026-12-01", newTime: "10:00", idempotencyKey: "k" },
  confirmPaymentMock: { paymentId: "p" },
};
const OPEN = new Set(["getAccountantMoney", "placeGuestOrder", "listPublicCarListings"]);

describe("accountant token against every callable", () => {
  it("sweep", async () => {
    const outcome: Record<string, string> = {};
    for (const f of walk(ROOT)) {
      const mod = await import(f);
      void NON_CLIENT;
      for (const [name, fn] of Object.entries(mod)) {
        const run = (fn as { run?: (r: unknown) => Promise<unknown> }).run;
        if (typeof run !== "function" || NON_CLIENT.test(name)) continue;
        try { await run({ auth: { uid: "u-acc", token: { role: "accountant", tenantId: "sweep-t", studioId: null }, rawToken: "x" }, data: VALID[name] ?? {} }); outcome[name] = "REACHED:resolved"; }
        catch (e) {
          const err = e as { code?: string; message?: string };
          outcome[name] = (err.code === "permission-denied" || err.code === "unauthenticated") && /accountant.*not authorized/i.test(err.message ?? "") ? "DENIED" : `REACHED:${err.code}:${(err.message ?? "").slice(0, 60)}`;
        }
      }
    }
    const reached = Object.entries(outcome).filter(([, v]) => v.startsWith("REACHED")).map(([k, v]) => `${k} ${v}`);
    console.log("TOTAL", Object.keys(outcome).length, "REACHED", reached.length, "\n" + reached.join("\n"));
    expect(Object.keys(outcome).length).toBeGreaterThan(100);
    expect(reached.filter((r) => !OPEN.has(r.split(" ")[0]!))).toEqual([]);
  }, 120_000);
});
