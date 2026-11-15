import { describe, it, expect, beforeEach } from "vitest";
import { captureAuthReturn, consumeAuthReturn, peekAuthReturn, isSafeInternalPath } from "./auth-return";

function fakeWindow() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
  };
  (globalThis as { window?: unknown }).window = { sessionStorage: storage };
  return storage;
}

describe("auth-return", () => {
  beforeEach(() => { fakeWindow(); });

  it("captures a catalogue category intent and returns it once", () => {
    captureAuthReturn("/catalogue?cat=ppf", 1000);
    expect(consumeAuthReturn(1001)).toBe("/catalogue?cat=ppf");
    expect(consumeAuthReturn(1002)).toBeNull(); // one-shot
  });

  it("captures a book service intent", () => {
    captureAuthReturn("/book/svc-coating-maintenance", 1000);
    expect(consumeAuthReturn(1001)).toBe("/book/svc-coating-maintenance");
  });

  it("rejects external/open-redirect destinations", () => {
    for (const bad of ["//evil.com/x", "https://evil.com", "\\\\evil", "/\nlogin", "", "/"]) {
      captureAuthReturn(bad, 1000);
      expect(consumeAuthReturn(1001)).toBeNull();
    }
  });

  it("never returns into auth screens", () => {
    for (const p of ["/login", "/welcome", "/setup", "/login?x=1"]) {
      captureAuthReturn(p, 1000);
      expect(consumeAuthReturn(1001)).toBeNull();
    }
    expect(isSafeInternalPath("/catalogue")).toBe(true);
  });

  it("discards stale intent after the TTL", () => {
    captureAuthReturn("/catalogue?cat=wash", 1_000_000);
    expect(consumeAuthReturn(1_000_000 + 31 * 60 * 1000)).toBeNull();
    expect(peekAuthReturn(1_000_000 + 31 * 60 * 1000)).toBeNull();
  });

  it("keeps fresh intent inside the TTL", () => {
    captureAuthReturn("/catalogue?cat=wash", 1_000_000);
    expect(peekAuthReturn(1_000_000 + 5 * 60 * 1000)).toBe("/catalogue?cat=wash");
  });

  it("clears a corrupted record instead of replaying it", () => {
    captureAuthReturn("/catalogue?cat=wash", 1000);
    const s = fakeWindow(); // new store keeps map? no - fresh; seed corrupt below
    s.setItem("autodeck.authReturn.v1", "{not json");
    expect(consumeAuthReturn(1001)).toBeNull();
  });
});
