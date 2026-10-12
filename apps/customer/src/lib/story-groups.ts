import type { StoryView } from "@autodeck/core";

export type StoryGroup = { key: string; title: string; live: boolean; cover: string | null; items: StoryView[] };

/** One circle for today's stories, then one per highlight title. Items inside play oldest first. */
export function groupStories(list: StoryView[], now = Date.now()): StoryGroup[] {
  const asc = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const live = asc.filter((s) => Date.parse(s.expiresAt) > now);
  const groups: StoryGroup[] = [];
  if (live.length) groups.push({ key: "live", title: "Today", live: true, cover: live[live.length - 1]!.mediaType === "image" ? live[live.length - 1]!.url : live.find((s) => s.mediaType === "image")?.url ?? null, items: live });
  const pinned = asc.filter((s) => s.pinned);
  const byTitle = new Map<string, StoryView[]>();
  for (const s of pinned) {
    const t = (s.highlightTitle ?? "").trim() || "Highlights";
    byTitle.set(t, [...(byTitle.get(t) ?? []), s]);
  }
  // Newest collection first, so what the studio just added is the first circle after Today.
  const cols = [...byTitle.entries()].sort((a, b) => b[1][b[1].length - 1]!.createdAt.localeCompare(a[1][a[1].length - 1]!.createdAt));
  for (const [title, items] of cols) {
    groups.push({ key: `highlight:${title}`, title, live: false, cover: items.find((s) => s.mediaType === "image")?.url ?? null, items });
  }
  return groups;
}
