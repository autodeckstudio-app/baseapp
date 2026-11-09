vi.mock("@autodeck/ui", () => ({ TextInput: () => null }));
vi.mock("@autodeck/ui/theme", () => ({ space: {} }));
vi.mock("../../ui/kit", () => ({
  Button: () => null,
  Kicker: () => null,
  T: () => null,
}));
/** Actual login screen handlers; Google provider, native primitive and visual shell are adapters. */
import React from "react";
import { act, create } from "react-test-renderer";
import { vi, it, expect, beforeEach, afterEach } from "vitest";
const h = vi.hoisted(() => ({ signin: vi.fn() }));
vi.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: () => {} }));
vi.mock("../../lib/native-google-signin", () => ({
  signInWithNativeGoogle: vi.fn(),
}));
vi.mock("../../lib/auth-service", () => ({
  devGoogleSignIn: vi.fn(),
  googleSignInConfigured: () => true,
  signInWithGooglePopup: () => h.signin(),
  useEmulator: false,
}));
vi.mock("@autodeck/ui/native", () => ({
  AuthButton: (p: any) => React.createElement("auth-button", p),
}));
vi.mock("../../ui/LoginStage", () => ({
  LoginStage: ({ children, error }: any) =>
    React.createElement("login-stage", { error }, children),
}));
import Login from "./login";
beforeEach(() => {
  h.signin.mockReset();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());
it("invalid provider login shows retryable error and clears busy, successful retry stays busy until navigation or timeout", async () => {
  h.signin
    .mockRejectedValueOnce({ code: "auth/invalid-credential" })
    .mockResolvedValueOnce(undefined);
  let r: any;
  await act(async () => {
    r = create(<Login />);
  });
  await act(async () => {
    r.root.findByType("auth-button").props.onPress();
    await Promise.resolve();
  });
  expect(r.root.findByType("login-stage").props.error).toBe(
    "Couldn't sign you in. Please try again.",
  );
  expect(r.root.findByType("auth-button").props.busy).toBe(false);
  await act(async () => {
    r.root.findByType("auth-button").props.onPress();
    await Promise.resolve();
  });
  expect(r.root.findByType("login-stage").props.error).toBeNull();
  expect(r.root.findByType("auth-button").props.busy).toBe(true);
  expect(h.signin).toHaveBeenCalledTimes(2);
  await act(async () => { vi.advanceTimersByTime(10000); });
  expect(r.root.findByType("auth-button").props.busy).toBe(false);
  r.unmount();
});
it("cancelled provider login does not falsely report successful sign-in", async () => {
  h.signin.mockRejectedValue({ code: "auth/popup-closed-by-user" });
  let r: any;
  await act(async () => {
    r = create(<Login />);
  });
  await act(async () => {
    r.root.findByType("auth-button").props.onPress();
    await Promise.resolve();
  });
  expect(r.root.findByType("login-stage").props.error).toBe(
    "The Google window closed before sign-in finished. Try again.",
  );
  expect(r.root.findByType("auth-button").props.busy).toBe(false);
  r.unmount();
});

it("same-tick repeated taps launch only one Google request",async()=>{let resolve:any;h.signin.mockImplementation(()=>new Promise(r=>resolve=r));let r:any;await act(async()=>{r=create(<Login/>)});const press=r.root.findByType("auth-button").props.onPress;await act(async()=>{press();press();press()});expect(h.signin).toHaveBeenCalledTimes(1);await act(async()=>resolve(undefined));await act(async()=>{vi.advanceTimersByTime(10000)});r.unmount()});
it("overlapping-provider code does not claim the user cancelled",async()=>{h.signin.mockRejectedValue({code:"auth/cancelled-popup-request"});let r:any;await act(async()=>{r=create(<Login/>)});await act(async()=>{r.root.findByType("auth-button").props.onPress();await Promise.resolve()});expect(r.root.findByType("login-stage").props.error).toBe("Another sign-in interrupted this attempt. Try again.");r.unmount()});
