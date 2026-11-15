import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("white-only lock for studio and admin", () => {
  it("stays light even when the device and clock say night", async () => {
    vi.stubEnv("EXPO_PUBLIC_THEME_LOCK", "light");
    const { currentMode } = await import("@autodeck/ui/theme");
    expect(currentMode()).toBe("light");
  });
  it("admin build flag locks light too", async () => {
    vi.stubEnv("NEXT_PUBLIC_THEME_LOCK", "light");
    const { currentMode } = await import("@autodeck/ui/theme");
    expect(currentMode()).toBe("light");
  });
  it("customer app (no lock) still follows the device", async () => {
    vi.stubEnv("EXPO_PUBLIC_THEME_LOCK", "");
    vi.stubEnv("NEXT_PUBLIC_THEME_LOCK", "");
    (globalThis as { matchMedia?: unknown }).matchMedia = () => ({ matches: true });
    const { currentMode } = await import("@autodeck/ui/theme");
    expect(currentMode()).toBe("night");
    delete (globalThis as { matchMedia?: unknown }).matchMedia;
  });
});
