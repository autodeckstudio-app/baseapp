import { describe, expect, it } from "vitest";
import { isInAppBrowser, shouldFallBackToRedirect } from "./browser";

describe("isInAppBrowser", () => {
  it("matches embedded webviews", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Instagram 300.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14) [FBAN/EMA;FBAV/400.0]")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36")).toBe(true);
  });
  it("leaves real browsers alone", () => {
    expect(isInAppBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1")).toBe(false);
    expect(isInAppBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36")).toBe(false);
    expect(isInAppBrowser(undefined)).toBe(false);
  });
});

describe("shouldFallBackToRedirect", () => {
  it("falls back only when popups can't work", () => {
    expect(shouldFallBackToRedirect("auth/popup-blocked")).toBe(true);
    expect(shouldFallBackToRedirect("auth/popup-closed-by-user")).toBe(false);
  });
});
