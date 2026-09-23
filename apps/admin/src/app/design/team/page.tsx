"use client";

// Static preview (no data, no auth). Sample records only.
import type { Employee } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { TeamView } from "../../../experience/TeamView";
import "../../../experience/shell.css";

const E = (id: string, name: string, email: string, role: string, authUid: string, terminatedAt: string | null = null) => ({ id, name, email, role, authUid, terminatedAt, active: !terminatedAt, studioId: role === "studio" ? "main" : null }) as unknown as Employee;
const ROWS = [
  E("1", "Studio Owner", "autodeckstudio@gmail.com", "admin", "u0"),
  E("2", "Vikram Solanki", "vikram.floor@gmail.com", "studio", "u1"),
  E("3", "Imran Shaikh", "imran.detail@gmail.com", "studio", ""),
  E("4", "Pooja Rana", "pooja.frontdesk@gmail.com", "admin", "u3"),
  E("5", "Rahul Vora", "rahul.v@gmail.com", "studio", "u4", "2026-08-01T00:00:00Z"),
];

export default function Preview() {
  return (
    <StaffShell pathname="/staff" office role="admin" who="studio@autodeck.example" home="/design/team" onSignOut={() => {}}>
      <TeamView staff={ROWS} loading={false} error={null} message={null} busy={false} onAdd={() => {}} onRole={() => {}} onRemove={() => {}} />
    </StaffShell>
  );
}
