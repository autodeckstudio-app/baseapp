import React from "react";
import { it, expect, vi } from "vitest";
import { act, create } from "react-test-renderer";
import type { Membership } from "@autodeck/core";
vi.mock("./kit", () => ({ Chip: "Chip", Pane: "Pane", T: "T" }));
import { MembershipCard } from "./MembershipCard";
it("actual card updates refresh balance after live record/restore and hides unearned pending benefit", async () => {
  const membership = { id: "m", tier: "platinum", status: "active", washesTotal: 8, washesUsed: 0, startDate: "2026-11-01", endDate: "2026-12-01", refreshesTotal: 1, refreshesUsed: 0 } as Membership;
  let r: any;
  await act(async () => { r = create(<MembershipCard membership={membership} today="2026-11-19" />); });
  expect(JSON.stringify(r.toJSON())).toContain("1 of 1 interior refresh left");
  await act(async () => r.update(<MembershipCard membership={{ ...membership, refreshesUsed: 1 }} today="2026-11-19" />));
  expect(JSON.stringify(r.toJSON())).toContain("0 of 1 interior refresh left");
  await act(async () => r.update(<MembershipCard membership={membership} today="2026-11-19" />));
  expect(JSON.stringify(r.toJSON())).toContain("1 of 1 interior refresh left");
  await act(async () => r.update(<MembershipCard membership={{ ...membership, status: "pending" }} today="2026-11-19" />));
  expect(JSON.stringify(r.toJSON())).not.toContain("interior refresh left");
  await act(async () => r.unmount());
});
