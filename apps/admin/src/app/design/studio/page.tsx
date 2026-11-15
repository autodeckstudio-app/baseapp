"use client";

// Static preview (no data, no auth). Sample records only.
import type { StudioConfig } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { StudioView } from "../../../experience/StudioView";
import "../../../experience/shell.css";

const H = (d: number, open: string, close: string, closed = false) => ({ dayOfWeek: d, open, close, closed });
const CFG = {
  name: "AutoDeck Ahmedabad", timezone: "Asia/Kolkata", taxRatePercent: 18,
  operatingHours: [H(0, "10:00", "14:00", true), H(1, "09:00", "19:00"), H(2, "09:00", "19:00"), H(3, "09:00", "19:00"), H(4, "09:00", "19:00"), H(5, "09:00", "19:00"), H(6, "10:00", "17:00")],
  holidays: ["2026-10-20", "2026-11-08", "2026-11-09"],
  bays: [{ id: "b1", name: "Bay 1", bayType: "wash", active: true }, { id: "b2", name: "Bay 2", bayType: "protection", active: true }, { id: "b3", name: "Bay 3", bayType: "general", active: true }, { id: "b4", name: "Bay 4", bayType: "wash", active: false }],
} as unknown as StudioConfig;

export default function Preview() {
  return (
    <StaffShell pathname="/studio" office role="admin" who="studio@autodeck.example" home="/design/studio" onSignOut={() => {}}>
      <StudioView config={CFG} loading={false} error={null} message={null} busy={false} onSaveProfile={() => {}} onAddHoliday={() => {}} onRemoveHoliday={() => {}} onAddBay={() => {}} onToggleBay={() => {}} />
    </StaffShell>
  );
}
