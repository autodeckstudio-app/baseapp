/**
 * Studio floor must be able to read what Admin lists as open. Runs the exact two
 * list queries apps/studio/src/lib/studio-service.ts listenToJobsByDate issues,
 * as a studio-role staff user, against the real rules.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { FIRST_TENANT_ID } from "@autodeck/core";
import { mergeFloorJobs, OPEN_FLOOR_STATUSES } from "../../../../apps/studio/src/lib/floor-jobs";

let env: RulesTestEnvironment;
const STUDIO = "studio-ahmedabad";
const TODAY = "2026-10-28";

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "autodeck-dev",
    firestore: {
      rules: readFileSync(resolve(__dirname, "../../../../firestore.rules"), "utf8"),
      host: "localhost",
      port: Number(process.env["FIRESTORE_EMULATOR_TEST_PORT"] ?? (process.env["FIRESTORE_EMULATOR_HOST"]?.split(":")[1] ?? "8080")),
    },
  });
  await env.clearFirestore();
  const mk = (id: string, status: string, date: string, studioId = STUDIO, tenantId: string = FIRST_TENANT_ID) => ({
    id, status, tenantId, studioId, scheduledDate: date, estimatedEndDate: date, scheduledAt: `${date}T09:00:00.000Z`,
  });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const j of [
      mk("overrun", "IN_PROGRESS", "2026-10-26"),
      mk("waiting", "READY_FOR_DELIVERY", "2026-10-19"),
      mk("today", "VEHICLE_RECEIVED", TODAY),
      mk("future", "PENDING_VEHICLE", "2026-10-29"),
      mk("standby", "STANDBY", "2026-10-27"),
      mk("done", "DELIVERED", "2026-10-20"),
      mk("cancelled", "CANCELLED", "2026-10-21"),
      mk("other-studio", "IN_PROGRESS", "2026-10-26", "studio-other"),
      mk("other-tenant", "IN_PROGRESS", "2026-10-26", STUDIO, "tenant-other"),
    ]) await db.collection("jobs").doc(j.id).set(j);
  });
});
afterAll(async () => { await env.cleanup(); });

describe("studio staff floor queries", () => {
  const staff = () => env.authenticatedContext("uid-studio", { role: "studio", tenantId: FIRST_TENANT_ID, studioId: STUDIO }).firestore();

  it("window query alone misses the overrunning and waiting jobs (the bug)", async () => {
    const snap = await staff().collection("jobs").where("tenantId", "==", FIRST_TENANT_ID).where("studioId", "==", STUDIO)
      .where("scheduledDate", ">=", "2026-10-14").where("scheduledDate", "<=", TODAY).get();
    const ids = mergeFloorJobs(snap.docs.map((d) => d.data() as never), [], TODAY, false).map((j) => j.id);
    expect(ids).toEqual(["today"]);
  });

  it("open-status query is allowed by the rules and the merge shows what Admin lists as open", async () => {
    const db = staff();
    const win = await db.collection("jobs").where("tenantId", "==", FIRST_TENANT_ID).where("studioId", "==", STUDIO)
      .where("scheduledDate", ">=", "2026-10-14").where("scheduledDate", "<=", TODAY).get();
    const open = await db.collection("jobs").where("tenantId", "==", FIRST_TENANT_ID).where("studioId", "==", STUDIO)
      .where("status", "in", [...OPEN_FLOOR_STATUSES]).get();
    const ids = mergeFloorJobs(win.docs.map((d) => d.data() as never), open.docs.map((d) => d.data() as never), TODAY, true).map((j) => j.id);
    expect(ids).toEqual(["waiting", "overrun", "standby", "today"]);
  });

  it("rules still refuse a tenant-wide query without the tenant filter", async () => {
    await assertFails(staff().collection("jobs").where("studioId", "==", STUDIO).where("status", "in", [...OPEN_FLOOR_STATUSES]).get());
  });
});
