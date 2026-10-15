"use client";

// Web push for staff: chat alerts. Same Firebase project and public Web Push key as the customer app.
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
const VAPID = process.env["NEXT_PUBLIC_FIREBASE_VAPID_KEY"] ?? "BM4fcynnn84IEkH5nCi_VSAqUBVvS_xqOUW8Vsf-VAxKNXxVWfTZ-NjebGh5LLZzWjnlO0T_x4Y_-QjdHY8M9vc";

export const pushAvailable = (): boolean => typeof g.Notification !== "undefined" && g.navigator?.serviceWorker !== undefined;
export const pushState = (): "on" | "prompt" | "denied" | "unavailable" => {
  if (!pushAvailable()) return "unavailable";
  const p = g.Notification.permission as string;
  return p === "granted" ? "on" : p === "denied" ? "denied" : "prompt";
};

async function registerToken(): Promise<void> {
  const { getMessaging, getToken } = await import("firebase/messaging");
  const { getApp } = await import("firebase/app");
  const reg = await g.navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  await httpsCallable(functions, "registerPushToken")({ token });
}

export async function enablePush(): Promise<"on" | "denied" | "unavailable"> {
  if (!pushAvailable()) return "unavailable";
  if ((await g.Notification.requestPermission()) !== "granted") return "denied";
  await registerToken();
  return "on";
}

/** Re-register on each signed-in session once permission is granted, so a rotated token heals itself. Never prompts, never throws. */
export async function syncPushRegistration(): Promise<void> {
  if (pushState() !== "on") return;
  try { await registerToken(); } catch { /* a stale worker must not break the session */ }
}
