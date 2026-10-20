import { z } from "zod";
import { STORY_HIGHLIGHTS } from "@autodeck/core";

const highlight = z.enum(STORY_HIGHLIGHTS);

const contentType = z.enum(["image/jpeg", "image/png", "image/webp", "video/mp4"]);

export const issueStoryUploadUrlSchema = z.object({
  studioId: z.string().min(1),
  contentType,
}).strict();

export const createStorySchema = z.object({
  studioId: z.string().min(1),
  path: z.string().min(1).max(300),
  contentType,
  caption: z.string().max(200).optional(),
  highlightTitle: highlight.optional(),
}).strict();

export const updateStorySchema = z.object({
  storyId: z.string().min(1),
  caption: z.string().max(200).nullable().optional(),
  pinned: z.boolean().optional(),
  highlightTitle: highlight.nullable().optional(),
  hidden: z.boolean().optional(),
}).strict();

export const listStoriesSchema = z.object({
  includeAll: z.boolean().optional(),
}).strict();

export const deleteStorySchema = z.object({ storyId: z.string().min(1) }).strict();
