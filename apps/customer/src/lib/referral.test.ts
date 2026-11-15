import { describe, expect, it } from "vitest";
import { REFERRAL_LIVE, REFERRAL_REWARD_TEXT, normaliseReferralCode, referralCodeFor, referralCodeToSend, referralShareMessage, referralSubtitle } from "./referral";

describe("referral", () => {
  it("is dark until the server can redeem the reward", () => {
    expect(REFERRAL_LIVE).toBe(false);
  });
  it("promises nothing and shows no code while dark", () => {
    const code = referralCodeFor("uid-1");
    expect(referralShareMessage(code, false)).not.toContain("free");
    expect(referralShareMessage(code, false)).not.toContain(code);
    expect(referralSubtitle(code, false)).toBe("Share AutoDeck");
    expect(referralCodeToSend(code, "someone-else", false)).toBeNull();
  });
  it("shows the code and the one reward line once live", () => {
    const code = referralCodeFor("uid-1");
    expect(referralShareMessage(code, true)).toContain(REFERRAL_REWARD_TEXT);
    expect(referralShareMessage(code, true)).toContain(code);
    expect(referralSubtitle(code, true)).toBe(`Your code ${code}`);
  });
  it("keeps the reward to the friend's first wash", () => {
    expect(REFERRAL_REWARD_TEXT).toBe("Your friend's first wash is free");
  });
  it("codes are stable, well formed and differ between people", () => {
    expect(referralCodeFor("abc")).toBe(referralCodeFor("abc"));
    expect(normaliseReferralCode(referralCodeFor("abc"))).toBe(referralCodeFor("abc"));
    const set = new Set(Array.from({ length: 2000 }, (_, i) => referralCodeFor(`customer-${i}-xyz`)));
    expect(set.size).toBeGreaterThan(1990);
  });
  it("tidies typed codes and rejects junk", () => {
    const c = referralCodeFor("abc");
    expect(normaliseReferralCode(` ${c.toLowerCase().slice(0, 4)}-${c.slice(4)} `)).toBe(c);
    expect(normaliseReferralCode("HELLO")).toBeNull();
    expect(normaliseReferralCode("AD0O1I2")).toBeNull();
  });
  it("never sends the customer's own code", () => {
    expect(referralCodeToSend(referralCodeFor("me"), "me", true)).toBeNull();
    expect(referralCodeToSend(referralCodeFor("friend"), "me", true)).toBe(referralCodeFor("friend"));
  });
});
