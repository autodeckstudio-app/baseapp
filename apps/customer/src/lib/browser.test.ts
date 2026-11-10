import { describe, expect, it } from "vitest";
import { isInAppBrowser, isIosBrowser, shouldFallBackToRedirect } from "./browser";

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

describe("isIosBrowser", () => {
  it("matches iPhone and iPod Safari", () => {
    expect(isIosBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile Safari/604.1", 5)).toBe(true);
    expect(isIosBrowser("Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) Mobile/15E148", 5)).toBe(true);
  });
  it("matches iPadOS reporting itself as a touch-capable Mac", () => {
    expect(isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 5)).toBe(true);
  });
  it("leaves desktop and Android browsers on the popup path", () => {
    expect(isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15", 0)).toBe(false);
    expect(isIosBrowser("Mozilla/5.0 (X11; Linux x86_64) Chrome/126.0", 0)).toBe(false);
    expect(isIosBrowser("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0 Mobile Safari/537.36", 5)).toBe(false);
    expect(isIosBrowser(undefined, 5)).toBe(false);
  });
});

describe("shouldFallBackToRedirect", () => {
  it("falls back only when popups can't work", () => {
    expect(shouldFallBackToRedirect("auth/popup-blocked")).toBe(true);
    expect(shouldFallBackToRedirect("auth/operation-not-supported-in-this-environment")).toBe(true);
    expect(shouldFallBackToRedirect("auth/web-storage-unsupported")).toBe(true);
  });
  it("keeps user-facing popup failures on the error path", () => {
    expect(shouldFallBackToRedirect("auth/popup-closed-by-user")).toBe(false);
    expect(shouldFallBackToRedirect("auth/cancelled-popup-request")).toBe(false);
    expect(shouldFallBackToRedirect(undefined)).toBe(false);
  });
});
