"use client";

import { httpsCallable } from "firebase/functions";
import type { StoryView } from "@autodeck/core";
import { functions } from "./firebase";

export async function listAllStories(): Promise<StoryView[]> {
  const fn = httpsCallable<{ includeAll: boolean }, { stories: StoryView[] }>(functions, "listStories");
  return (await fn({ includeAll: true })).data.stories;
}

/** Upload the file with a signed PUT, then publish it as a story. */
export async function publishStory(input: { studioId: string; file: File; caption?: string; highlightTitle?: string }): Promise<{ id: string }> {
  const contentType = input.file.type;
  const issue = httpsCallable<{ studioId: string; contentType: string }, { uploadUrl: string; path: string; requiredHeaders: Record<string, string> }>(functions, "issueStoryUploadUrl");
  const { uploadUrl, path, requiredHeaders } = (await issue({ studioId: input.studioId, contentType })).data;
  const put = await fetch(uploadUrl, { method: "PUT", headers: requiredHeaders, body: input.file });
  if (!put.ok) throw new Error("The upload did not go through. Try again.");
  const create = httpsCallable<Record<string, unknown>, { id: string }>(functions, "createStory");
  return (
    await create({
      studioId: input.studioId,
      path,
      contentType,
      ...(input.caption ? { caption: input.caption } : {}),
      ...(input.highlightTitle ? { highlightTitle: input.highlightTitle } : {}),
    })
  ).data;
}

export async function updateStory(input: { storyId: string; pinned?: boolean; highlightTitle?: string | null; hidden?: boolean }): Promise<void> {
  const fn = httpsCallable<typeof input, { id: string }>(functions, "updateStory");
  await fn(input);
}
