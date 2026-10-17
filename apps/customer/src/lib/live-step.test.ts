import { describe, expect, it } from "vitest";
import { liveStep } from "./live-step";
describe("liveStep", () => {
  it("maps progress to one of four steps", () => {
    expect([null, 10, 25, 55, 85, 100].map(liveStep)).toEqual([0, 0, 0, 2, 3, 3]);
  });
});
