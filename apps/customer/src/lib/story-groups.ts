import { STORY_HIGHLIGHTS, storyHighlightCategory, type StoryView } from "@autodeck/core";

export type StoryGroup = { key: string; title: string; live: boolean; cover: string | null; items: StoryView[] };

/** The tray: Today first (stories under 24 h), then the five highlights in their fixed order. A circle with nothing in it is not shown.
 *  Items inside play oldest first. A pinned story with a title outside the five is not shown. */
export function groupStories(list: StoryView[], now = Date.now()): StoryGroup[] {
  const asc = [...list].filter((s) => !s.hidden).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const photo = (items: StoryView[]) => [...items].reverse().find((s) => s.mediaType === "image")?.url ?? null;
  const groups: StoryGroup[] = [];
  const live = asc.filter((s) => Date.parse(s.expiresAt) > now);
  if (live.length) groups.push({ key: "live", title: "Today", live: true, cover: photo(live), items: live });
  for (const title of STORY_HIGHLIGHTS) {
    const items = asc.filter((s) => s.pinned && storyHighlightCategory(s.highlightTitle) === title);
    if (items.length) groups.push({ key: `highlight:${title}`, title, live: false, cover: photo(items), items });
  }
  return groups;
}

/** Key that changes when a circle gets a newer story, so its ring lights up again. */
export function seenKeyOf(g: StoryGroup): string {
  return `${g.key}@${g.items[g.items.length - 1]?.id ?? ""}`;
}

/** "2h", "3d": how long ago a story was posted. */
export function storyAge(iso: string, now = Date.now()): string {
  const m = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/** Home's five persistent categories. Stored PPF/Ceramic pins remain compatible:
 * Protection presents both without changing the publishing schema or old records. */
export const HOME_STORY_CATEGORIES=STORY_HIGHLIGHTS;
export function homeStoryGroups(list:StoryView[],now=Date.now()):StoryGroup[]{
 const visible=[...list].filter(s=>!s.hidden).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
 const categories=HOME_STORY_CATEGORIES.map(title=>{
  const items=visible.filter(s=>s.pinned&&storyHighlightCategory(s.highlightTitle)===title);
  return{key:`highlight:${title}`,title,live:false,cover:[...items].reverse().find(s=>s.mediaType==='image')?.url??null,items};
 });
 const today=groupStories(list,now).find(g=>g.live);
 return today?[today,...categories]:categories;
}
