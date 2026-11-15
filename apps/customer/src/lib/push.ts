// Web push (FCM). iPhone/iPad: web push only works after the site is added to
// the Home Screen. The VAPID value is the public Web Push certificate from the
// Firebase console (Project settings > Cloud Messaging) - public by design, it
// ships to every browser like the rest of the web config. The
// EXPO_PUBLIC_FIREBASE_VAPID_KEY env var can override it at build time.
import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
const FIREBASE_VAPID_PUBLIC_KEY =
  "BM4fcynnn84IEkH5nCi_VSAqUBVvS_xqOUW8Vsf-VAxKNXxVWfTZ-NjebGh5LLZzWjnlO0T_x4Y_-QjdHY8M9vc";
const VAPID = process.env["EXPO_PUBLIC_FIREBASE_VAPID_KEY"] ?? FIREBASE_VAPID_PUBLIC_KEY;

export const pushAvailable = (): boolean =>
  Platform.OS === "web" && VAPID !== "" && g.Notification !== undefined && g.navigator?.serviceWorker !== undefined;

export type PushPermission = "on" | "prompt" | "denied" | "unavailable";

export function pushPermission(): PushPermission {
  if (!pushAvailable()) return "unavailable";
  const p = g.Notification?.permission as string | undefined;
  return p === "granted" ? "on" : p === "denied" ? "denied" : "prompt";
}

async function registerToken(): Promise<void> {
  const { getMessaging, getToken } = await import("firebase/messaging");
  const reg = await g.navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const { getApp } = await import("firebase/app");
  const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  await httpsCallable(functions, "registerPushToken")({ token });
}

// Ask for permission (browser prompt), then register this device's token.
export async function enablePush(): Promise<"on" | "denied" | "unavailable"> {
  if (!pushAvailable()) return "unavailable";
  if ((await g.Notification.requestPermission()) !== "granted") return "denied";
  await registerToken();
  return "on";
}

// Silent refresh for browsers that already granted permission: re-register the
// token on each signed-in session so a rotated or expired token self-heals.
// Never prompts and never throws into app start.
export async function syncPushRegistration(): Promise<void> {
  if (pushPermission() !== "on") return;
  try {
    await registerToken();
  } catch {
    // A stale service worker or revoked token must not break the session.
  }
}

// Foreground pushes: FCM shows no system notification while the tab is
// focused, so surface the payload in the app instead. Returns unsubscribe.
export function onForegroundPush(handler: (title: string, body: string) => void): () => void {
  if (!pushAvailable()) return () => undefined;
  let active = true;
  let unsub: (() => void) | undefined;
  void (async () => {
    try {
      const { getMessaging, onMessage } = await import("firebase/messaging");
      const { getApp } = await import("firebase/app");
      if (!active) return;
      unsub = onMessage(getMessaging(getApp()), (payload) => {
        handler(payload.notification?.title ?? "AutoDeck", payload.notification?.body ?? "");
      });
    } catch {
      // Messaging unsupported in this browser - in-app list still updates.
    }
  })();
  return () => {
    active = false;
    unsub?.();
  };
}
