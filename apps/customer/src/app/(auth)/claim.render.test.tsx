// Claim screen render proof: renewal copy, the no-code exit, flat wrong-code
// error, and the post-claim anomaly copy (never misreported as a wrong code).
// UI kit pieces are mocked to host views (pnpm isolation keeps react-native-web
// out of packages/ui); auth-service and expo-router are mocked. Proves wiring
// and copy, not on-device styling.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { create, act } from "react-test-renderer";
import React, { createElement } from "react";
// Mock react-native itself: minimal host components keep the tree inspectable
// without react-native-web's DOM dependencies.
vi.mock("react-native", () => {
  const mk = (name: string) => (props: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement(name, props, props.children);
  return {
    View: mk("View"),
    Text: mk("Text"),
    Pressable: mk("Pressable"),
    TextInput: mk("TextInput"),
    KeyboardAvoidingView: mk("KeyboardAvoidingView"),
    Platform: { OS: "ios", select: (o: Record<string, unknown>) => o.ios ?? o.default },
  };
});

const claimMock = vi.fn<(code: string) => Promise<{ customerId: string }>>();
const setupMock = vi.fn<() => Promise<unknown>>();
const signOutMock = vi.fn<() => Promise<void>>(() => Promise.resolve());
const replaceMock = vi.fn();

vi.mock("../../lib/auth-service", () => ({
  claimCustomerRecord: (c: string) => claimMock(c),
  setupCustomerProfile: () => setupMock(),
  refreshAuthToken: async () => {},
  signOut: () => signOutMock(),
  isClaimRequired: (r: unknown) => (r as { claimRequired?: boolean }).claimRequired === true,
  rememberMyCustomerDocId: async () => {},
  auth: { currentUser: null },
}));
vi.mock("expo-router", () => ({
  useRouter: () => ({ replace: replaceMock }),
  useLocalSearchParams: () => ({ renewal: "1" }),
}));
vi.mock("../../ui/LegalLinks", () => ({ LegalLinks: () => null }));
vi.mock("@autodeck/ui", () => ({
  TextInput: (props: Record<string, unknown>) => createElement("TextInput", props),
}));
vi.mock("@autodeck/ui/theme", () => ({ space: { line: 8, gap: 12 } }));
vi.mock("@autodeck/ui/native", () => ({ Ambient: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../../ui/kit", () => ({
  Button: ({ label, onPress, testID }: { label: string; onPress: () => void; testID?: string }) =>
    createElement("Pressable", { onPress, testID, accessibilityRole: "button" }, createElement("Text", null, label)),
  Kicker: ({ children }: { children: React.ReactNode }) => createElement("Text", null, children),
  T: ({ children }: { children: React.ReactNode }) => createElement("Text", null, children),
}));

import ClaimScreen from "./claim";

function textOf(el: ReturnType<typeof create>): string {
  const walk = (n: unknown): string => {
    if (n === null || n === undefined || typeof n === "boolean") return "";
    if (typeof n === "string") return n;
    if (Array.isArray(n)) return n.map(walk).join(" ");
    const o = n as { children?: unknown };
    return walk(o.children);
  };
  return walk(el.toJSON()).replace(/\s+/g, " ").trim();
}

async function renderScreen() {
  let el!: ReturnType<typeof create>;
  await act(async () => { el = create(createElement(ClaimScreen)); });
  await act(async () => { await Promise.resolve(); });
  return el!;
}

async function submitCode(el: ReturnType<typeof create>, code: string) {
  const input = el.root.findByProps({ placeholder: "XXXX-XXXX" });
  await act(async () => { input.props.onChangeText(code); });
  const btn = el.root.findByProps({ testID: "claim-continue" });
  await act(async () => { btn.props.onPress(); });
}

beforeEach(() => { claimMock.mockReset(); setupMock.mockReset(); replaceMock.mockReset(); signOutMock.mockClear(); });

describe("Claim screen", () => {
  it("renewal state asks the studio for a code and offers the no-code exit", async () => {
    const el = await renderScreen();
    const t = textOf(el);
    expect(t).toContain("Ask the AutoDeck studio team for a code");
    expect(t).toContain("I don't have a code");
  });

  it("a failed claim shows the flat error, never record details", async () => {
    claimMock.mockRejectedValue(new Error("failed-precondition"));
    const el = await renderScreen();
    await submitCode(el, "ABCD-EFGH");
    expect(textOf(el)).toContain("That code did not work. Check it with the studio.");
  });

  it("claim accepted but profile missing: anomaly copy, NOT the wrong-code wording", async () => {
    claimMock.mockResolvedValue({ customerId: "staged-1" });
    setupMock.mockResolvedValue({ claimRequired: true, renewalRequired: true });
    const el = await renderScreen();
    await submitCode(el, "ABCD-EFGH");
    const t = textOf(el);
    expect(t).toContain("did not finish linking");
    expect(t).not.toContain("That code did not work");
  });

  it("the no-code exit signs out and returns to welcome", async () => {
    const el = await renderScreen();
    const btn = el.root.findByProps({ testID: "claim-no-code" });
    await act(async () => { btn.props.onPress(); });
    await act(async () => { await Promise.resolve(); });
    expect(signOutMock).toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/(auth)/welcome");
  });
});
