import { describe, it, expect } from "vitest";
import { FirebaseError } from "firebase/app";
import { PhoneMultiFactorGenerator, type MultiFactorResolver } from "firebase/auth";
import { isMultiFactorRequiredError, pickPhoneHint } from "./mfa";

describe("isMultiFactorRequiredError", () => {
  it("returns true for auth/multi-factor-auth-required", () => {
    const err = new FirebaseError("auth/multi-factor-auth-required", "MFA required");
    expect(isMultiFactorRequiredError(err)).toBe(true);
  });

  it("returns false for other FirebaseError codes", () => {
    const err = new FirebaseError("auth/wrong-password", "Wrong password");
    expect(isMultiFactorRequiredError(err)).toBe(false);
  });

  it("returns false for a non-FirebaseError value", () => {
    expect(isMultiFactorRequiredError(new Error("plain error"))).toBe(false);
    expect(isMultiFactorRequiredError("not an error")).toBe(false);
    expect(isMultiFactorRequiredError(null)).toBe(false);
  });
});

describe("pickPhoneHint", () => {
  function resolverWithHints(hints: Array<{ factorId: string }>): MultiFactorResolver {
    return { hints, session: {} } as unknown as MultiFactorResolver;
  }

  it("returns the phone hint when present", () => {
    const phoneHint = { factorId: PhoneMultiFactorGenerator.FACTOR_ID, uid: "hint-1" };
    const resolver = resolverWithHints([phoneHint]);
    expect(pickPhoneHint(resolver)).toBe(phoneHint);
  });

  it("returns null when no enrolled factor is phone-based", () => {
    const resolver = resolverWithHints([{ factorId: "totp" }]);
    expect(pickPhoneHint(resolver)).toBeNull();
  });

  it("returns null when there are no hints at all", () => {
    const resolver = resolverWithHints([]);
    expect(pickPhoneHint(resolver)).toBeNull();
  });
});
