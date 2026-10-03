import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

// Sends a web push for each in-app notification. OFF unless the function is
// deployed with PUSH_ENABLED=true, so deploying it changes nothing until then.
export const onNotificationPush = onDocumentCreated(
  { document: "notifications/{id}", region: "asia-south1" },
  async (event) => {
    if (process.env["PUSH_ENABLED"] !== "true") return;
    const n = event.data?.data() as { userId?: string; title?: string; body?: string; entityType?: string; entityId?: string } | undefined;
    if (!n?.userId || !n.title) return;
    const db = getFirestore();
    const ref = db.collection("pushTokens").doc(n.userId);
    const tokens = ((await ref.get()).data()?.["tokens"] ?? []) as string[];
    if (tokens.length === 0) return;
    const res = await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title: n.title, body: n.body ?? "" },
      data: { entityType: n.entityType ?? "", entityId: n.entityId ?? "" },
      webpush: { fcmOptions: { link: n.entityType === "booking" && n.entityId ? `/bookings/${n.entityId}` : "/" } },
    });
    const dead = tokens.filter((_, i) => {
      const c = res.responses[i]?.error?.code;
      return c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token";
    });
    if (dead.length) await ref.set({ tokens: FieldValue.arrayRemove(...dead) }, { merge: true });
  },
);
