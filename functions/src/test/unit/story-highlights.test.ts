import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { STORY_HIGHLIGHTS } from "@autodeck/core";
import { createStorySchema, updateStorySchema, deleteStorySchema } from "../../schemas/story.js";

const base = { studioId: "s", path: "t/stories/x.png", contentType: "image/png" };

describe("story highlights are exactly the five", () => {
  it("the list", () => { expect([...STORY_HIGHLIGHTS]).toEqual(["PPF", "Ceramic", "Detailing", "Washing", "Modifications"]); });
  it("create accepts only those titles", () => {
    for (const h of STORY_HIGHLIGHTS) expect(createStorySchema.safeParse({ ...base, highlightTitle: h }).success).toBe(true);
    expect(createStorySchema.safeParse({ ...base, highlightTitle: "Coatings" }).success).toBe(false);
    expect(createStorySchema.safeParse(base).success).toBe(true);
  });
  it("update accepts only those titles or null", () => {
    expect(updateStorySchema.safeParse({ storyId: "a", highlightTitle: "Washing" }).success).toBe(true);
    expect(updateStorySchema.safeParse({ storyId: "a", highlightTitle: null, pinned: false }).success).toBe(true);
    expect(updateStorySchema.safeParse({ storyId: "a", highlightTitle: "Highlights" }).success).toBe(false);
  });
  it("delete needs a story id and nothing else", () => {
    expect(deleteStorySchema.safeParse({ storyId: "a" }).success).toBe(true);
    expect(deleteStorySchema.safeParse({ storyId: "a", x: 1 }).success).toBe(false);
  });
  it("deleteStory is exported, admin only, audited, and removes the file after the record", () => {
    expect(readFileSync(`${__dirname}/../../index.ts`, "utf8")).toContain("deleteStory");
    const s = readFileSync(`${__dirname}/../../functions/story/deleteStory.ts`, "utf8");
    expect(s).toContain('assertRole(user, "admin", "superadmin")'); expect(s).toContain("story.deleted");
    expect(s.indexOf("tx.delete(ref)")).toBeLessThan(s.indexOf(".delete({ ignoreNotFound"));
  });
});
