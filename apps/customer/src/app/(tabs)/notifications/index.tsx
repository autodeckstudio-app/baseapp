import { glassInner } from "../../../lib/glass";
import { repairText } from "../../../lib/text-repair";
import { invoiceHref } from "../../../lib/invoice-display";
import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "../../../ui/NavIcon";
import { Button, Kicker, Loading, Notice, PageHeader, Pane, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { enablePush, pushPermission, type PushPermission } from "../../../lib/push";
import { listenToMyNotifications, markNotificationRead } from "../../../lib/notification-service";
import { useAuth } from "../../../hooks/useAuth";
import { clearable, isProtected, loadHidden, saveHidden, visibleNotifications } from "../../../lib/notification-hidden";


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
  const [hidden, setHidden] = useState<Set<string>>(() => loadHidden());
  const hide = (ids: string[]) => { const next = new Set([...hidden, ...ids]); setHidden(next); saveHidden(next); };
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

  const shown = visibleNotifications(notifications, hidden);
  const canClear = clearable(shown).length > 0;

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
      {canClear ? <Button kind="quiet" label="Clear all" onPress={() => hide(clearable(shown))} /> : null}
      {pushState === "prompt" && pushPermission() === "prompt" ? (
        <Notice
          title="Get updates on this device"
          body="Turn on alerts so booking updates reach you even when the app is closed."
          action={<Button label="Turn on alerts" onPress={() => void enablePush().then((r) => setPushState(r)).catch(() => setPushState(pushPermission()))} />}
        />
      ) : null}
      {shown.length === 0 ? (
        <Notice title="You are all caught up" body="Updates about your bookings and services will show up here. Older read ones tidy away after 30 days." />
      ) : (
        <View style={{ gap: space.line }}>
          {shown.map((item) => {
            const unread = item.readAt === null && !asked.has(item.id);
            return (
              <Pressable key={item.id} accessibilityRole="button" onPress={() => void handlePress(item)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                <Pane pad="inset">
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space.line }}>
                    <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: unread ? "rgba(236,134,56,0.22)" : glassInner.backgroundColor }}>
                      <NavIcon name="bell" color={unread ? colors.accent : colors.textSecondary} size={20} cut="#18181C" />
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <T role="bodyStrong">{repairText(item.title)}</T>
                      <T role="caption" tone="secondary">{repairText(item.body)}</T>
                      <T role="caption" tone="tertiary">{formatWhen(item.createdAt)}</T>
                      {NOTIFICATION_ACTION[item.entityType ?? ""] ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={NOTIFICATION_ACTION[item.entityType ?? ""]} onPress={(e) => { e.stopPropagation?.(); void handlePress(item); }} style={({ pressed }) => ({ alignSelf: "flex-start", marginTop: 6, minHeight: 36, borderRadius: 9999, paddingHorizontal: 14, justifyContent: "center", backgroundColor: item.entityType === "Approval" ? "rgba(236,134,56,0.22)" : glassInner.backgroundColor, opacity: pressed ? 0.8 : 1 })}>
                          <T role="caption" style={{ fontWeight: "700", color: colors.textPrimary }}>{NOTIFICATION_ACTION[item.entityType ?? ""]}</T>
                        </Pressable>
                      ) : null}
                      {!isProtected(item) ? (
                        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" hitSlop={8} onPress={(e) => { e.stopPropagation?.(); hide([item.id]); }} style={{ alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}>
                          <T role="caption" tone="tertiary">Dismiss</T>
                        </Pressable>
                      ) : null}
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
