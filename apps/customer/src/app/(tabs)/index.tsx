import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import type { Booking } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, LoadingState, formatDateShort } from "@autodeck/ui";
import { getMyBookings } from "../../lib/booking-service";
import { useAuth } from "../../hooks/useAuth";

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [nextBooking, setNextBooking] = useState<Booking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);

  useEffect(() => {
    if (auth.status !== "ready") return;
    getMyBookings(auth.user.uid, auth.claims.tenantId)
      .then((bookings) => {
        const upcoming = bookings
          .filter((b) => b.status === "PENDING" || b.status === "CONFIRMED" || b.status === "ACTIVE")
          .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
        setNextBooking(upcoming[0] ?? null);
      })
      .catch(() => setNextBooking(null))
      .finally(() => setLoadingBooking(false));
  }, [auth.status]);

  if (auth.status !== "ready") {
    return <LoadingState />;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.display, color: colors.textPrimary, marginTop: spacing.md }}>
        Hi{auth.user.displayName ? `, ${auth.user.displayName.split(" ")[0]}` : ""}
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xxs, marginBottom: spacing.xl }}>
        What would you like to get done today?
      </Text>

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
          onPress={() => router.push("/(tabs)/vehicles")}
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: radius.md,
            paddingVertical: spacing.md,
            alignItems: "center",
          }}
        >
          <Text style={{ ...typography.captionMedium, color: colors.textPrimary }}>My Vehicles</Text>
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
