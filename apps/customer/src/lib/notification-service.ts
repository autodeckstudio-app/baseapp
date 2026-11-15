import { collection, query, where, orderBy, limit, onSnapshot, type Unsubscribe } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { Notification } from "@autodeck/core";

export function listenToMyNotifications(
  tenantId: string,
  uid: string,
  onData: (notifications: Notification[]) => void,
  onError: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, COLLECTIONS.notifications()),
    where("tenantId", "==", tenantId),
    where("userId", "==", uid),
    orderBy("createdAt", "desc"),
    limit(50),
  );
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => d.data() as Notification)),
    onError,
  );
}

type MarkNotificationReadInput = { notificationId: string };
type MarkNotificationReadOutput = { notificationId: string };

export async function markNotificationRead(notificationId: string): Promise<void> {
  const fn = httpsCallable<MarkNotificationReadInput, MarkNotificationReadOutput>(
    functions,
    "markNotificationRead",
  );
  await fn({ notificationId });
}
