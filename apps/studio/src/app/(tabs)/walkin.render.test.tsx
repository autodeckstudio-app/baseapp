// Walk-in intake render proof: after a FRESH staged registration the counter
// code is issued and shown exactly once with the tell-the-customer copy; for
// an existing record no code is issued or shown. Services, auth and router
// are mocked at the module boundary; the kit is mocked to host views. Proves
// wiring + copy, not on-device styling.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import React, { createElement } from "react";

const registerMock = vi.fn();
const issueMock = vi.fn();
vi.mock("../../lib/walkin-service", () => ({
  findCustomersBySearch: async () => [],
  registerWalkinCustomer: (input: unknown) => registerMock(input),
  issueClaimCode: (id: string) => issueMock(id),
  getVehiclesForCustomer: async () => [],
  createVehicleForCustomer: async () => ({}),
  previewServicePrice: async () => ({ breakdown: null }),
}));
vi.mock("../../lib/studio-service", () => ({
  listenToJobsByDate: () => () => {},
  getStudioConfig: async () => ({ bays: [] }),
  createWalkinJob: async () => ({}),
}));
vi.mock("../../lib/lookup-service", () => ({
  loadCustomerDirectory: async () => ({ customers: [], vehicles: [] }),
  filterDirectory: () => [],
}));
vi.mock("../../lib/approval-service", () => ({ getActiveServices: async () => [] }));
vi.mock("../../hooks/useAuth", () => ({
  useAuth: () => ({ status: "ready", user: { uid: "staff1" }, claims: { tenantId: "automodz", role: "studio", studioId: "s1" } }),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: () => {}, back: () => {}, replace: () => {} }),
}));
vi.mock("@autodeck/ui", () => ({
  isNightPalette: () => true,
  colors: new Proxy({}, { get: () => "#fff" }),
  spacing: new Proxy({}, { get: () => 8 }),
  radius: new Proxy({}, { get: () => 8 }),
  typography: new Proxy({}, { get: () => ({}) }),
  Button: ({ label, onPress }: { label: string; onPress?: () => void }) =>
    createElement("Pressable", { onPress, accessibilityRole: "button" }, createElement("Text", null, label)),
  TextInput: (props: Record<string, unknown>) => createElement("TextInput", props),
  StatusBadge: () => null,
  LoadingState: () => null,
  ErrorState: ({ title, message }: { title: string; message: string }) =>
    createElement("Text", null, `${title}: ${message}`),
}));
vi.mock("@autodeck/ui/theme", () => ({ nightGroundStyle: () => ({}), nightSurfaceStyle: () => ({}) }));

import WalkinScreen from "./walkin";

function textOf(el: ReturnType<typeof create>): string {
  const walk = (n: unknown): string => {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    return walk((n as { children?: unknown }).children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
}

async function renderScreen() {
  let el!: ReturnType<typeof create>;
  await act(async () => { el = create(createElement(WalkinScreen)); });
  await act(async () => { await Promise.resolve(); });
  return el!;
}

async function registerNew(el: ReturnType<typeof create>, name: string, email: string) {
  await act(async () => { el.root.findByProps({ label: "Add new customer" }).props.onPress(); });
  await act(async () => { el.root.findByProps({ label: "Name" }).props.onChangeText(name); });
  await act(async () => { el.root.findByProps({ label: "Email (their Google account)" }).props.onChangeText(email); });
  await act(async () => { el.root.findByProps({ label: "Save and continue" }).props.onPress(); });
}

const staged = { id: "staged-1", tenantId: "automodz", name: "Asha Rao", email: "asha@example.com", phone: null, authUid: null, deletedAt: null };

beforeEach(() => { registerMock.mockReset(); issueMock.mockReset(); });

describe("Walk-in counter code", () => {
  it("fresh registration issues the code once and shows the tell-them copy", async () => {
    registerMock.mockResolvedValue({ customer: staged, created: true });
    issueMock.mockResolvedValue({ code: "K7X2-9QWD", expiresAt: "2026-12-04T00:00:00Z" });
    const el = await renderScreen();
    await registerNew(el, "Asha Rao", "asha@example.com");
    const t = textOf(el);
    expect(issueMock).toHaveBeenCalledWith("staged-1");
    expect(t).toContain("Counter code: K7X2-9QWD");
    expect(t).toContain("Shown once; a new code from the admin page replaces it.");
    expect(t).toContain("continue with Google using asha@example.com");
  });

  it("existing record: no code issued, no code copy", async () => {
    registerMock.mockResolvedValue({ customer: staged, created: false });
    const el = await renderScreen();
    await registerNew(el, "Asha Rao", "asha@example.com");
    expect(issueMock).not.toHaveBeenCalled();
    expect(textOf(el)).not.toContain("Counter code");
  });

  it("code issue failure never blocks intake and shows no code copy", async () => {
    registerMock.mockResolvedValue({ customer: staged, created: true });
    issueMock.mockRejectedValue(new Error("unavailable"));
    const el = await renderScreen();
    await registerNew(el, "Asha Rao", "asha@example.com");
    const t = textOf(el);
    expect(t).not.toContain("Counter code");
    expect(t).toContain("continue with Google using asha@example.com");
  });
});
