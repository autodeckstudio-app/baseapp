"use client";

// Static preview (no data, no auth). Sample records only.
import type { StoryView } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { StoriesView } from "../../../experience/StoriesView";
import "../../../experience/shell.css";

const now = Date.now();
const PAL = ["#3B5B7A", "#7A4B3B", "#4B6B4B", "#6B4B7A", "#7A6B3B"];
/** Sample picture (no network): a coloured card, 9:16. */
const art = (id: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="360" height="640"><rect width="360" height="640" fill="${PAL[Number(id) % 5]}"/><text x="180" y="330" font-size="28" fill="#fff" text-anchor="middle" font-family="sans-serif">Sample ${id}</text></svg>`)}`;
const S = (id: string, hoursAgo: number, title: string | null, caption: string): StoryView => ({ id, mediaType: "image", url: art(id), caption, pinned: title !== null, highlightTitle: title, hidden: false, createdAt: new Date(now - hoursAgo * 3600e3).toISOString(), expiresAt: new Date(now - hoursAgo * 3600e3 + 24 * 3600e3).toISOString() });
const ROWS = [S("1", 2, null, "Ceramic coat delivery"), S("2", 30, "Ceramic", "Gtechniq on a Thar"), S("3", 50, "Ceramic", "Prolong cure"), S("4", 90, "Detailing", "Interior detail"), S("5", 120, "Modifications", "Studio tour")];

export default function Preview() {
  return (
    <StaffShell pathname="/stories" office role="admin" who="studio@autodeck.example" home="/design/stories" onSignOut={() => {}}>
      <StoriesView stories={ROWS} loading={false} busy={false} error={null} message={null} onPublish={() => {}} onPin={() => {}} onHide={() => {}} onDelete={() => {}} />
    </StaffShell>
  );
}
