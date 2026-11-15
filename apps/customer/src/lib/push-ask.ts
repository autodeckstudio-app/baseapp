// When to ask for push: once, right after the customer's booking request is sent, with a plain reason.
export function shouldAskPush(permission: "on" | "prompt" | "denied" | "unavailable", askedBefore: boolean): boolean {
  return permission === "prompt" && !askedBefore;
}

export const PUSH_ASKED_KEY = "ad.pushAsked.v1";
