// Web push (FCM). OFF unless EXPO_PUBLIC_FIREBASE_VAPID_KEY is set at build time.
// iPhone/iPad: web push only works after the site is added to the Home Screen.
import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;
const VAPID = process.env["EXPO_PUBLIC_FIREBASE_VAPID_KEY"] ?? "";

export const pushAvailable = (): boolean =>
  Platform.OS === "web" && VAPID !== "" && g.Notification !== undefined && g.navigator?.serviceWorker !== undefined;

export async function enablePush(): Promise<"on" | "denied" | "unavailable"> {
  if (!pushAvailable()) return "unavailable";
  if ((await g.Notification.requestPermission()) !== "granted") return "denied";
  const { getMessaging, getToken } = await import("firebase/messaging");
  const reg = await g.navigator.serviceWorker.register("/firebase-messaging-sw.js");
  const { getApp } = await import("firebase/app");
  const token = await getToken(getMessaging(getApp()), { vapidKey: VAPID, serviceWorkerRegistration: reg });
  await httpsCallable(functions, "registerPushToken")({ token });
  return "on";
}
