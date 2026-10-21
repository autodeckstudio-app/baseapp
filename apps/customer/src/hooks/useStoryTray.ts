// Story tray state for a screen: loads the studio stories once when ready, tracks which groups were seen and which one is open.
import { useEffect, useState } from "react";
import { getStories, groupStories, type StoryGroup } from "../lib/story-service";
import { seenKeyOf } from "../lib/story-groups";

export function useStoryTray(ready: boolean) {
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [open, setOpen] = useState<StoryGroup | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const load = (tries: number) => void getStories().then((l) => { if (!alive) return; if (l.length === 0 && tries > 0) setTimeout(() => load(tries - 1), 2500); else setGroups(groupStories(l)); }).catch(() => undefined);
    load(2);
    return () => { alive = false; };
  }, [ready]);
  const show = (g: StoryGroup) => { setOpen(g); setSeen((x) => new Set([...x, seenKeyOf(g)])); };
  return {
    groups, open, seen, show,
    close: () => setOpen(null),
    next: () => { const n = open ? groups[groups.findIndex((x) => x.key === open.key) + 1] : undefined; if (n) show(n); else setOpen(null); },
    prev: () => { const n = open ? groups[groups.findIndex((x) => x.key === open.key) - 1] : undefined; if (n) setOpen(n); },
  };
}
