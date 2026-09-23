import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import type { Booking, ServiceJob, Vehicle } from "@autodeck/core";
import { projectCustomerHome } from "@autodeck/experience";
import { colors, spacing, radius, typography, Button, IconButton, LoadingState, formatDateShort } from "@autodeck/ui";
import { getMyBookings } from "../../lib/booking-service";
import { listenToMyVehicles } from "../../lib/vehicle-service";
import { listenToMyJobs } from "../../lib/job-service";
import { listenToMyNotifications } from "../../lib/notification-service";
import { useAuth } from "../../hooks/useAuth";
import { getActiveVehicleId } from "../../lib/experience-preferences";

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (auth.status !== "ready") return;
    getMyBookings(auth.user.uid, auth.claims.tenantId)
      .then((allBookings) => {
        const upcoming = allBookings
          .filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE")
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        setBookings(allBookings);
        setNextBooking(upcoming[0] ?? null);
      })
      .catch(() => setNextBooking(null))
      .finally(() => setLoadingBooking(false));
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    void getActiveVehicleId(auth.user.uid).then(setSelectedVehicleId).catch(() => undefined);
    const stopVehicles = listenToMyVehicles(auth.user.uid, auth.claims.tenantId, setVehicles, () => undefined);
    const stopJobs = listenToMyJobs(auth.claims.tenantId, auth.user.uid, setJobs, () => undefined);
    return () => { stopVehicles(); stopJobs(); };
  }, [auth.status]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyNotifications(
      auth.claims.tenantId,
      auth.user.uid,
      (notifications) => setUnreadCount(notifications.filter((n) => n.readAt === null).length),
      () => undefined,
    );
  }, [auth.status]);

  if (auth.status !== "ready") {
    return <LoadingState />;
  }

  const home = projectCustomerHome({ displayName: auth.user.displayName, vehicles, selectedVehicleId, bookings, jobs });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...typography.display, color: colors.textPrimary }}>
            Hi{auth.user.displayName ? `, ${auth.user.displayName.split(" ")[0]}` : ""}
          </Text>
          <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xxs, marginBottom: spacing.xl }}>
            {home.statement}
          </Text>
        </View>
        <View>
          <IconButton
            glyph="⍾"
            accessibilityLabel="Notifications"
            onPress={() => router.push("/(tabs)/notifications")}
          />
          {unreadCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: 2,
                right: 2,
                minWidth: 16,
                height: 16,
                borderRadius: radius.full,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 3,
              }}
            >
              <Text style={{ ...typography.label, color: colors.white, fontSize: 10 }}>
                {unreadCount > 9 ? "9+" : unreadCount}
              </Text>
            </View>
          )}
        </View>
      </View>

      {home.activeVehicle && (
        <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm }}>
          {home.activeVehicle.registrationNumber} · {home.detail}
        </Text>
      )}

      {loadingBooking ? (
        <LoadingState fill={false} />
      ) : nextBooking ? (
        <TouchableOpacity
          onPress={() => router.push(`/(tabs)/bookings/${nextBooking.id}`)}
          style={{
            backgroundColor: colors.textPrimary,
            borderRadius: radius.lg,
            padding: spacing.lg,
            marginBottom: spacing.xl,
          }}
        >
          <Text style={{ ...typography.caption, color: colors.surface, opacity: 0.7 }}>Upcoming booking</Text>
          <Text style={{ ...typography.title, color: colors.white, marginTop: spacing.xxs }}>
            {formatDateShort(nextBooking.scheduledDate)} at {nextBooking.scheduledTime}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl }}>
          <Text style={{ ...typography.body, color: colors.textMuted }}>No upcoming bookings</Text>
        </View>
      )}

      <Button label="Book a service" onPress={() => router.push("/(tabs)/catalogue")} />

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/garage")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ ...typography.captionMedium, color: colors.textPrimary }}>My Garage</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/bookings")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ ...typography.captionMedium, color: colors.textPrimary }}>My Bookings</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
