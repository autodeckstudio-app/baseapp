import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Notification } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { colors, spacing, radius, typography, EmptyState, ErrorState, LoadingState, formatDateShort, formatTime } from "@autodeck/ui";
import { db } from "../../../lib/firebase";
import { listenToMyNotifications, markNotificationRead } from "../../../lib/notification-service";
import { useAuth } from "../../../hooks/useAuth";

interface InvoiceRef {
  jobId: string;
  tenantId: string;
  customerId: string;
}

export default function NotificationsScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (auth.status !== "ready") return undefined;
    setLoading(true);
    setError(null);
    return listenToMyNotifications(
      auth.claims.tenantId,
      auth.user.uid,
      (data) => {
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
  }, [load]);

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

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<EmptyState title="No notifications yet" message="Updates about your bookings and services will show up here." fill={false} />}
        renderItem={({ item }) => {
          const unread = item.readAt === null;
          return (
            <TouchableOpacity
              onPress={() => void handlePress(item)}
              style={{
                flexDirection: "row",
                gap: spacing.sm,
                backgroundColor: unread ? colors.accentMuted : colors.surface,
                borderRadius: radius.lg,
                padding: spacing.lg,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: radius.full,
                  backgroundColor: unread ? colors.accent : "transparent",
                  marginTop: 6,
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>{item.title}</Text>
                <Text style={{ ...typography.caption, color: colors.textSecondary, marginTop: spacing.xxs }}>{item.body}</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
                  {formatDateShort(item.createdAt)} · {formatTime(item.createdAt)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}
