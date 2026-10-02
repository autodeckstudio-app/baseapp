/**
 * A studio story: a photo or short video shown for 24 hours in the customer
 * app's story circles. Pinned stories stay forever as a Highlight. Media sits
 * in Storage and is read through short-lived signed URLs from the listStories
 * callable, so no storage rule change is involved.
 */
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
