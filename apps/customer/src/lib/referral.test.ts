import { describe, expect, it } from "vitest";
import { REFERRAL_LIVE, REFERRAL_REWARD_TEXT, referralShareMessage, referralSubtitle } from "./referral";

describe("referral", () => {
  it("is dark until the server can redeem the reward", () => {
    expect(REFERRAL_LIVE).toBe(false);
  });
  it("promises nothing while dark", () => {
    expect(referralShareMessage(false)).not.toContain("free");
    expect(referralSubtitle(false)).toBe("Share AutoDeck");
  });
  it("adds the reward text from the single config value once live", () => {
    expect(referralShareMessage(true)).toContain(REFERRAL_REWARD_TEXT);
    expect(referralSubtitle(true)).toBe(REFERRAL_REWARD_TEXT);
  });
  it("keeps the reward to the friend's first wash", () => {
    expect(REFERRAL_REWARD_TEXT).toBe("Your friend's first wash is free");
  });
});
