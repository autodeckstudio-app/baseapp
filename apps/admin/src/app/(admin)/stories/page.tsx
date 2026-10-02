"use client";

import { useCallback, useEffect, useState } from "react";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import type { StoryView } from "@autodeck/core";
import { listAllStories, publishStory, updateStory } from "../../../lib/story-service";
import { useAdminAuth } from "../../../lib/auth-context";
import { StoriesView } from "../../../experience/StoriesView";

export default function StoriesPage() {
  const { claims } = useAdminAuth();
  const [stories, setStories] = useState<StoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const studioId = claims?.studioId ?? FIRST_STUDIO_ID;

  const load = useCallback(async () => {
    try {
      setStories(await listAllStories());
    } catch {
      setError("Couldn't load stories.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { if (claims) void load(); }, [claims, load]);

  async function run(action: () => Promise<unknown>, ok: string, fail: string) {
    setBusy(true); setError(null); setMessage(null);
    try { await action(); setMessage(ok); await load(); }
    catch (err) { setError(err instanceof Error && err.message ? err.message : fail); }
    finally { setBusy(false); }
  }

  return (
    <StoriesView
      stories={stories}
      loading={loading}
      busy={busy}
      error={error}
      message={message}
      onPublish={(i) => void run(() => publishStory({ studioId, file: i.file, caption: i.caption, highlightTitle: i.highlightTitle }), "Story posted.", "Couldn't post the story.")}
      onPin={(s, title) => void run(() => updateStory(title ? { storyId: s.id, pinned: true, highlightTitle: title } : { storyId: s.id, pinned: false, highlightTitle: null }), title ? "Pinned to Highlights." : "Unpinned.", "Couldn't update the story.")}
      onHide={(s) => void run(() => updateStory({ storyId: s.id, hidden: !s.hidden }), s.hidden ? "Story shown." : "Story hidden.", "Couldn't update the story.")}
    />
  );
}
