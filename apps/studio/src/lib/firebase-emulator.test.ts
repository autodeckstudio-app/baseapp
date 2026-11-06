import { vi, it, expect, afterEach } from "vitest";
const h = vi.hoisted(() => ({
  fs: vi.fn(),
  fn: vi.fn(),
  auth: vi.fn(),
  storage: vi.fn(),
}));
vi.mock("firebase/app", () => ({
  getApps: () => [{}],
  initializeApp: () => ({}),
}));
vi.mock("firebase/auth", () => ({
  initializeAuth: () => ({}),
  getReactNativePersistence: undefined,
  browserLocalPersistence: {},
  browserPopupRedirectResolver: {},
  connectAuthEmulator: (...x: any[]) => h.auth(...x),
}));
vi.mock("firebase/firestore", () => ({
  initializeFirestore: () => ({}),
  connectFirestoreEmulator: (...x: any[]) => h.fs(...x),
}));
vi.mock("firebase/functions", () => ({
  getFunctions: () => ({}),
  connectFunctionsEmulator: (...x: any[]) => h.fn(...x),
}));
vi.mock("firebase/storage", () => ({
  getStorage: () => ({}),
  connectStorageEmulator: (...x: any[]) => h.storage(...x),
}));
vi.mock("react-native", () => ({ Platform: { OS: "web" } }));
vi.mock("@react-native-async-storage/async-storage", () => ({ default: {} }));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  vi.resetModules();
});
it("public web emulator flag connects all four real-client boundaries at configured loopback ports, independently of one already connected client", async () => {
  vi.stubEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "demo-autodeck-shell");
  vi.stubEnv("USE_FIREBASE_EMULATOR", "");
  vi.stubEnv("EXPO_PUBLIC_USE_FIREBASE_EMULATOR", "true");
  vi.stubEnv("EXPO_PUBLIC_FIREBASE_EMULATOR_HOST", "127.0.0.1");
  vi.stubEnv("EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT", "8189");
  h.fs.mockImplementationOnce(() => {
    throw Error("already");
  });
  await import("./firebase");
  expect(h.auth).toHaveBeenCalledWith(
    expect.anything(),
    "http://127.0.0.1:9099",
    { disableWarnings: true },
  );
  expect(h.fn).toHaveBeenCalledWith(expect.anything(), "127.0.0.1", 5001);
  expect(h.storage).toHaveBeenCalledWith(expect.anything(), "127.0.0.1", 9199);
});
it("absent flags never connects demo clients", async () => {
  vi.stubEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "demo-autodeck-shell");
  vi.stubEnv("USE_FIREBASE_EMULATOR", "");
  vi.stubEnv("EXPO_PUBLIC_USE_FIREBASE_EMULATOR", "");
  await import("./firebase");
  expect(h.auth).not.toHaveBeenCalled();
  expect(h.fs).not.toHaveBeenCalled();
  expect(h.fn).not.toHaveBeenCalled();
  expect(h.storage).not.toHaveBeenCalled();
});
it("actual web-specific entry connects Auth and transport under explicit public emulator flag", async () => {
  vi.stubGlobal("__DEV__", false);
  vi.stubEnv("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "demo-autodeck-shell");
  vi.stubEnv("EXPO_PUBLIC_USE_FIREBASE_EMULATOR", "true");
  vi.stubEnv("EXPO_PUBLIC_FIREBASE_EMULATOR_HOST", "127.0.0.1");
  vi.stubEnv("EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT", "8189");
  await import("./firebase.web");
  expect(h.auth).toHaveBeenCalledWith(
    expect.anything(),
    "http://127.0.0.1:9099",
    { disableWarnings: true },
  );
  expect(h.fs).toHaveBeenCalledWith(expect.anything(), "127.0.0.1", 8189);
  expect(h.fn).toHaveBeenCalledWith(expect.anything(), "127.0.0.1", 5001);
});
