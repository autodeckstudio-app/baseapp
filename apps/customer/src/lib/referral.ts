// Referral: one place for the reward wording and the share message every "Bring a friend" button uses.
/** The reward, as one value. Change it here and everywhere follows. */
export const REFERRAL_REWARD_TEXT = "Your friend's first wash is free";

/**
 * Stays false until the server can verify and redeem the reward (functions deploy is held). While false the share
 * message promises nothing, so no friend is told about a free wash the studio system cannot give yet.
 */
export const REFERRAL_LIVE = false;

const BASE = "AutoDeck, car care studio in Ahmedabad. Book on https://app.autodeck.in";

export function referralShareMessage(live: boolean = REFERRAL_LIVE): string {
  return live ? `${BASE}\n${REFERRAL_REWARD_TEXT}.` : BASE;
}

export function referralSubtitle(live: boolean = REFERRAL_LIVE): string {
  return live ? REFERRAL_REWARD_TEXT : "Share AutoDeck";
}
