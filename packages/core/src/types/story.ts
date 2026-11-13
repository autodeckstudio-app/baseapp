/**
 * A studio story: a photo or short video shown for 24 hours in the customer
 * app's story circles. Pinned stories stay forever as a Highlight. Media sits
 * in Storage and is read through short-lived signed URLs from the listStories
 * callable, so no storage rule change is involved.
 */
/** Current publisher choices. Legacy PPF/Ceramic pins remain accepted and readable. */
export const STORY_HIGHLIGHTS = ["Washing", "Detailing", "Protection", "Garage", "Modifications"] as const;
export type StoryHighlight = (typeof STORY_HIGHLIGHTS)[number];
export const STORY_HIGHLIGHT_INPUTS = [...STORY_HIGHLIGHTS, "PPF", "Ceramic"] as const;
export function storyHighlightCategory(value:string|null):StoryHighlight|null {
 if(value==="PPF"||value==="Ceramic")return "Protection";
 return (STORY_HIGHLIGHTS as readonly string[]).includes(value??"")?value as StoryHighlight:null;
}

export interface Story {
  id: string;
  tenantId: string;
  studioId: string;
  mediaPath: string;
  mediaType: "image" | "video";
  contentType: string;
  caption: string | null;
  pinned: boolean;
  highlightTitle: string | null;
  hidden: boolean;
  createdBy: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO, createdAt + 24h
  updatedAt: string; // ISO
}

/** What the customer app receives: the story plus a signed read URL. */
export interface StoryView {
  id: string;
  mediaType: "image" | "video";
  url: string;
  caption: string | null;
  pinned: boolean;
  highlightTitle: string | null;
  hidden: boolean;
  createdAt: string;
  expiresAt: string;
}
