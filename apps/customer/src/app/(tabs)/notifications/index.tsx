import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { Button, Kicker, Loading, Notice, Pane, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { listenToMyNotifications, markNotificationRead } from "../../../lib/notification-service";
import { useAuth } from "../../../hooks/useAuth";

interface InvoiceRef {
  jobId: string;
  tenantId: string;
  customerId: string;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

export default function NotificationsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryTick, setRetryTick] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (auth.status !== "ready") return undefined;
    setLoading(true);
    setError(null);
    return listenToMyNotifications(
      auth.claims.tenantId,
      auth.user.uid,
      (data) => {
        setError(null);
        setNotifications(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [auth.status]);

  useEffect(() => {
    const unsub = load();
    return unsub;
  }, [load, retryTick]);

  async function handlePress(n: Notification) {
    if (!n.readAt) void markNotificationRead(n.id).catch(() => undefined);

    if (n.entityType === "Booking" && n.entityId) {
      router.push(`/(tabs)/bookings/${n.entityId}`);
      return;
    }
    if (n.entityType === "Membership") {
      router.push("/(tabs)/membership/current");
      return;
    }
    if (n.entityType === "Approval" && n.entityId) {
      router.push(`/(tabs)/approvals/${n.entityId}`);
      return;
    }
    if (n.entityType === "Invoice" && n.entityId) {
      const snap = await getDoc(doc(db, COLLECTIONS.invoices(), n.entityId));
      if (snap.exists()) {
        const invoice = snap.data() as InvoiceRef;
        router.push({
          pathname: "/(tabs)/bookings/invoice",
          params: { jobId: invoice.jobId, tenantId: invoice.tenantId, customerId: invoice.customerId },
        });
      }
    }
  }

  if (loading) return <Loading label="Checking for updates" />;
  if (error) {
    return (
      <Screen>
        <Notice title="Can't load notifications" body={error} action={<Button label="Retry" onPress={() => setRetryTick((n) => n + 1)} />} />
      </Screen>
    );
  }

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Updates</Kicker><T role="title">Notifications</T></View>}>
      {notifications.length === 0 ? (
        <Notice title="No notifications yet" body="Updates about your bookings and services will show up here." />
      ) : (
        <View style={{ gap: space.line }}>
          {notifications.map((item) => {
            const unread = item.readAt === null;
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => void handlePress(item)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                <Pane pad="inset">
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.line }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: unread ? "rgba(236,134,56,0.22)" : "rgba(255,255,255,0.08)" }}>
                      <Icon name="bell" color={unread ? colors.accent : colors.textSecondary} size={20} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T role="bodyStrong">{item.title}</T>
                      <T role="caption" tone="secondary">{item.body}</T>
                      <T role="caption" tone="tertiary">{formatWhen(item.createdAt)}</T>
                    </View>
                    {unread ? <View style={{ width: 8, height: 8, borderRadius: 4, marginTop: 6, backgroundColor: colors.accent }} /> : null}
                  </View>
                </Pane>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
