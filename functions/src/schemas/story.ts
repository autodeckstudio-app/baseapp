import { z } from "zod";

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
  highlightTitle: z.string().max(30).optional(),
}).strict();

export const updateStorySchema = z.object({
  storyId: z.string().min(1),
  caption: z.string().max(200).nullable().optional(),
  pinned: z.boolean().optional(),
  highlightTitle: z.string().max(30).nullable().optional(),
  hidden: z.boolean().optional(),
}).strict();

export const listStoriesSchema = z.object({
  includeAll: z.boolean().optional(),
}).strict();
