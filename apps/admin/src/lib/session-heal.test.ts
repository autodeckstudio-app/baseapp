import { describe, it, expect, vi } from "vitest";
import { claimsForSignedInUser, type SessionHealDeps } from "./session-heal";

type C = { role: string };
function deps(over: Partial<SessionHealDeps<C>> = {}): SessionHealDeps<C> {
  return {
    getIdToken: vi.fn(async () => "tok"),
    fetchSessionClaims: vi.fn(async () => null),
    resolveClaims: vi.fn(async () => ({ changed: false })),
    exchangeIdToken: vi.fn(async () => ({ role: "admin" })),
    refreshIdToken: vi.fn(async () => "tok2"),
    ...over,
  };
}

describe("claimsForSignedInUser", () => {
  it("uses the existing session cookie when it is valid", async () => {
    const d = deps({ fetchSessionClaims: vi.fn(async () => ({ role: "admin" })) });
    expect(await claimsForSignedInUser(d)).toEqual({ role: "admin" });
    expect(d.exchangeIdToken).not.toHaveBeenCalled();
  });
  it("rebuilds the session when Firebase is signed in but the cookie is missing", async () => {
    const d = deps();
    expect(await claimsForSignedInUser(d)).toEqual({ role: "admin" });
    expect(d.exchangeIdToken).toHaveBeenCalledWith("tok");
  });
  it("refreshes the token when the role claims just changed", async () => {
    const d = deps({ resolveClaims: vi.fn(async () => ({ changed: true })) });
    await claimsForSignedInUser(d);
    expect(d.exchangeIdToken).toHaveBeenCalledWith("tok2");
  });
  it("returns null (sign out) when the account is not allowed", async () => {
    expect(await claimsForSignedInUser(deps({ resolveClaims: vi.fn(async () => null) }))).toBeNull();
    expect(await claimsForSignedInUser(deps({ exchangeIdToken: vi.fn(async () => null) }))).toBeNull();
  });
  it("returns null instead of throwing when the token cannot be read", async () => {
    expect(await claimsForSignedInUser(deps({ getIdToken: vi.fn(async () => { throw new Error("x"); }) }))).toBeNull();
  });
});
