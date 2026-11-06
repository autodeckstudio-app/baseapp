import React from "react";
import { create, act } from "react-test-renderer";
import { it, expect, vi, beforeEach } from "vitest";
const h = vi.hoisted(() => ({
  auth: { status: "unauthenticated" } as any,
  segments: ["(tabs)", "bookings"] as string[],
  router: { replace: vi.fn() },
  capture: vi.fn(),
  consume: vi.fn(),
}));
vi.mock("../hooks/useAuth", () => ({ useAuth: () => h.auth }));
vi.mock("expo-router", () => ({
  useRouter: () => h.router,
  useSegments: () => h.segments,
}));
vi.mock("../lib/auth-return", () => ({
  captureAuthReturn: (p: string) => h.capture(p),
  consumeAuthReturn: () => h.consume(),
}));
import { NavigationGuard } from "./NavigationGuard";
beforeEach(() => {
  h.auth = { status: "unauthenticated" };
  h.segments = ["(tabs)", "bookings"];
  h.router.replace.mockReset();
  h.capture.mockReset();
  h.consume.mockReset();
  vi.stubGlobal("window", {
    location: { pathname: "/bookings/own", search: "?from=link" },
  });
});
async function mount() {
  let r: any;
  await act(async () => {
    r = create(
      <NavigationGuard>
        <div />
      </NavigationGuard>,
    );
  });
  return r;
}
it("signed out own deep link captures intent then sends login", async () => {
  const r = await mount();
  expect(h.capture).toHaveBeenCalledWith("/bookings/own?from=link");
  expect(h.router.replace).toHaveBeenCalledWith("/(auth)/login");
  r.unmount();
});
it("ready login consumes exact safe return instead of losing it to home", async () => {
  h.auth = { status: "ready" };
  h.segments = ["(auth)", "login"];
  h.consume.mockReturnValue("/catalogue?cat=ppf");
  const r = await mount();
  expect(h.router.replace).toHaveBeenCalledWith("/catalogue?cat=ppf");
  r.unmount();
});
it("missing claims goes to setup but staged claim destination remains reachable", async () => {
  h.auth = { status: "authenticated_no_claims" };
  const r = await mount();
  expect(h.router.replace).toHaveBeenCalledWith("/(auth)/setup");
  h.router.replace.mockClear();
  h.segments = ["(auth)", "claim"];
  await act(async () =>
    r.update(
      <NavigationGuard>
        <div />
      </NavigationGuard>,
    ),
  );
  expect(h.router.replace).not.toHaveBeenCalled();
  r.unmount();
});
it("revoked session leaves a private screen for login; pending auth never navigates early", async () => {
  h.auth = { status: "loading" };
  const r = await mount();
  expect(h.router.replace).not.toHaveBeenCalled();
  h.auth = { status: "unauthenticated" };
  await act(async () =>
    r.update(
      <NavigationGuard>
        <div />
      </NavigationGuard>,
    ),
  );
  expect(h.router.replace).toHaveBeenCalledWith("/(auth)/login");
  r.unmount();
});
