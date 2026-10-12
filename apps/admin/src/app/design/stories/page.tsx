"use client";

// Static preview (no data, no auth). Sample records only.
import type { StoryView } from "@autodeck/core";
import { StaffShell } from "../../../experience/StaffShell";
import { StoriesView } from "../../../experience/StoriesView";
import "../../../experience/shell.css";

const now = Date.now();
const S = (id: string, hoursAgo: number, title: string | null, caption: string): StoryView => ({ id, mediaType: "image", url: "", caption, pinned: title !== null, highlightTitle: title, hidden: false, createdAt: new Date(now - hoursAgo * 3600e3).toISOString(), expiresAt: new Date(now - hoursAgo * 3600e3 + 24 * 3600e3).toISOString() });
const ROWS = [S("1", 2, null, "Ceramic coat delivery"), S("2", 30, "Coatings", "Gtechniq on a Thar"), S("3", 50, "Coatings", "Prolong cure"), S("4", 90, "Detailing", "Interior detail"), S("5", 120, "Highlights", "Studio tour")];

export default function Preview() {
  return (
    <StaffShell pathname="/stories" office role="admin" who="studio@autodeck.example" home="/design/stories" onSignOut={() => {}}>
      <StoriesView stories={ROWS} loading={false} busy={false} error={null} message={null} onPublish={() => {}} onPin={() => {}} onHide={() => {}} />
    </StaffShell>
  );
}
