"use client";

// Static preview (no data, no auth). Sample records only.
import type { MembershipPlan } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { MembershipsView } from "../../../experience/MembershipsView";
import "../../../experience/shell.css";

const M = (id: string, tier: string, name: string, rupees: number, includedWashes: number, discountPercent: number, active = true) => ({ id, tier, name, priceInPaise: rupees * 100, includedWashes, discountPercent, active }) as unknown as MembershipPlan;
const ROWS = [M("1", "silver", "Silver Care", 799, 2, 5), M("2", "gold", "Gold Shine", 1499, 4, 10), M("3", "platinum", "Platinum Studio", 2999, 8, 15), M("4", "silver", "Monsoon Saver", 599, 2, 0, false)];

export default function Preview() {
  return (
    <StaffShell pathname="/memberships" office role="admin" who="studio@autodeck.example" home="/design/memberships" onSignOut={() => {}}>
      <MembershipsView plans={ROWS} loading={false} error={null} message={null} busy={false} onSave={() => {}} onToggle={() => {}} />
    </StaffShell>
  );
}
