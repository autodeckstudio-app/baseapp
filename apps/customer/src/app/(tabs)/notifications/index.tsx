import { repairText } from "../../../lib/text-repair";
import { invoiceHref } from "../../../lib/invoice-display";
import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { Button, Kicker, Loading, Notice, PageHeader, Pane, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { enablePush, pushPermission, type PushPermission } from "../../../lib/push";
import { listenToMyNotifications, markNotificationRead } from "../../../lib/notification-service";
import { useAuth } from "../../../hooks/useAuth";


export const NOTIFICATION_ACTION: Record<string, string> = { Approval: "Review request", Booking: "View booking", Membership: "View membership", Invoice: "View invoice" };

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
  const [pushState, setPushState] = useState<PushPermission>(() => pushPermission());

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

  // Opening the list reads everything on it: mark each unread item read once,
  // and show it read right away instead of waiting for the server round trip.
  const [asked] = useState(() => new Set<string>());
  useEffect(() => {
    const fresh = notifications.filter((n) => n.readAt === null && !asked.has(n.id));
    if (fresh.length === 0) return;
    for (const n of fresh) {
      asked.add(n.id);
      void markNotificationRead(n.id).catch(() => asked.delete(n.id));
    }
  }, [notifications, asked]);

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
      // entityId is the invoice id: open that exact invoice (the rules still
      // decide whether this customer may read it).
      router.push(invoiceHref(n.entityId));
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
    <Screen header={<PageHeader kicker="Updates" title="Notifications" />}>
      {pushState === "prompt" && pushPermission() === "prompt" ? (
        <Notice
          title="Get updates on this device"
          body="Turn on alerts so booking updates reach you even when the app is closed."
          action={<Button label="Turn on alerts" onPress={() => void enablePush().then((r) => setPushState(r)).catch(() => setPushState(pushPermission()))} />}
        />
      ) : null}
      {notifications.length === 0 ? (
        <Notice title="No notifications yet" body="Updates about your bookings and services will show up here." />
      ) : (
        <View style={{ gap: space.line }}>
          {notifications.map((item) => {
            const unread = item.readAt === null && !asked.has(item.id);
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => void handlePress(item)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                <Pane pad="inset">
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.line }}>
                    <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: unread ? "rgba(236,134,56,0.22)" : "rgba(255,255,255,0.08)" }}>
                      <Icon name="bell" color={unread ? colors.accent : colors.textSecondary} size={20} />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T role="bodyStrong">{repairText(item.title)}</T>
                      <T role="caption" tone="secondary">{repairText(item.body)}</T>
                      <T role="caption" tone="tertiary">{formatWhen(item.createdAt)}</T>
                      {NOTIFICATION_ACTION[item.entityType ?? ""] ? <T role="caption" tone="accent" style={{ fontWeight: "700" }}>{NOTIFICATION_ACTION[item.entityType ?? ""]}</T> : null}
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
