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

export { groupStories, type StoryGroup } from "./story-groups";
