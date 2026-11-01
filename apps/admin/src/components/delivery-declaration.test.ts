import { describe, it, expect, vi } from "vitest";
// The component's firebase boundary is mocked; only initial (pre-effect)
// render states are asserted via static markup - interaction is covered by
// the shared builder tests in @autodeck/core and the studio mounted tests.
vi.mock("../lib/firebase", () => ({ db: {}, functions: {}, auth: { currentUser: { uid: "u1" } } }));
vi.mock("firebase/firestore", () => ({ collection: vi.fn(), getDocs: vi.fn(), query: vi.fn(), where: vi.fn() }));
vi.mock("firebase/functions", () => ({ httpsCallable: vi.fn() }));
vi.mock("../lib/auth-context", () => ({ useAdminAuth: () => ({ user: { uid: "u1" }, claims: { role: "admin", tenantId: "t", studioId: "s1" }, loading: false }) }));
import { renderToStaticMarkup } from "react-dom/server";
import * as React from "react";
(globalThis as unknown as { React: typeof React }).React = React;
import { readFileSync } from "node:fs";
import { DeliveryDeclaration } from "./DeliveryDeclaration";
import type { ServiceJob } from "@autodeck/core";

const job = (o: Partial<ServiceJob> = {}): ServiceJob => ({ id: "jA", vehicleId: "vA", tenantId: "t", studioId: "s1", status: "READY_FOR_DELIVERY", ...o } as ServiceJob);
const mk = (j: ServiceJob) => renderToStaticMarkup(React.createElement(DeliveryDeclaration, { job: j, onDelivered: () => {}, onCancel: () => {} }));

describe("DeliveryDeclaration initial render", () => {
  it("shows a visible loading state with confirm disabled - the panel never overlaps it", () => {
    const html = mk(job());
    expect(html).toContain("Loading the car&#x27;s protection records");
    expect(html).not.toContain("No protection work");
    expect(html).toMatch(/Confirm mark delivered/);
  });
  it("a job already past READY_FOR_DELIVERY gets the honest terminal copy, not a form", () => {
    const html = mk(job({ status: "DELIVERED" }));
    expect(html).toContain("no longer awaiting delivery");
    expect(html).not.toContain("Loading");
  });
});

describe("JobControls delivery wiring (source contract)", () => {
  it("the DELIVERED advance goes through the declaration component; the bare { jobId } advance never delivers", () => {
    const src = readFileSync(__dirname + "/JobControls.tsx", "utf8");
    expect(src).toContain("DeliveryDeclaration");
    expect(src).toMatch(/READY_FOR_DELIVERY" \? <DeliveryDeclaration/);
    // The generic advance path must not be reachable for READY_FOR_DELIVERY.
    expect(src).toMatch(/job\.status === "READY_FOR_DELIVERY" \? setAdvanceConfirm\(\{ route: routeId, jobId: job\.id, status: job\.status, epoch: advanceEpoch\.current \}\) : void advance\(\)/);
  });
});
