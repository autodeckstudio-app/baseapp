import { httpsCallable } from "firebase/functions";
import type { StoryView } from "@autodeck/core";
import { functions } from "./firebase";

/** Live stories (under 24h) and pinned highlights. Never throws: stories are a bonus, not a blocker for Home. */
export async function getStories(): Promise<StoryView[]> {
  try {
    const fn = httpsCallable<Record<string, never>, { stories: StoryView[] }>(functions, "listStories");
    return (await fn({})).data.stories;
  } catch {
    return [];
  }
}

export type StoryGroup = { key: string; title: string; live: boolean; cover: string | null; items: StoryView[] };

/** One circle for today's stories, then one per highlight title. Items inside play oldest first. */
export function groupStories(list: StoryView[], now = Date.now()): StoryGroup[] {
  const asc = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const live = asc.filter((s) => Date.parse(s.expiresAt) > now);
  const groups: StoryGroup[] = [];
  if (live.length) groups.push({ key: "live", title: "Today", live: true, cover: live[live.length - 1]!.mediaType === "image" ? live[live.length - 1]!.url : live.find((s) => s.mediaType === "image")?.url ?? null, items: live });
  const byTitle = new Map<string, StoryView[]>();
  for (const s of asc) if (s.pinned) byTitle.set(s.highlightTitle ?? "Highlights", [...(byTitle.get(s.highlightTitle ?? "Highlights") ?? []), s]);
  for (const [title, items] of byTitle) groups.push({ key: `h-${title}`, title, live: false, cover: items.find((s) => s.mediaType === "image")?.url ?? null, items });
  return groups;
}
