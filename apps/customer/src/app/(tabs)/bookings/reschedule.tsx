import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getBookingById, getAvailability, rescheduleBooking, generateIdempotencyKey, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Booking } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, LoadingState, ErrorState } from "@autodeck/ui";

export default function RescheduleBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadBooking = useCallback(() => {
    if (!bookingId) return;
    setLoading(true);
    void getBookingById(bookingId)
      .then(setBooking)
      .catch((err: unknown) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load booking.");
      })
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(loadBooking, [loadBooking]);

  const loadSlots = useCallback(() => {
    if (!booking) return;
    setSlotsLoading(true);
    setSlotsError(null);
    void getAvailability(booking.serviceId, booking.studioId, todayIST(), 14)
      .then(setSlots)
      .catch((err: unknown) => {
        setSlotsError(err instanceof Error ? err.message : "Could not load available times.");
      })
      .finally(() => setSlotsLoading(false));
  }, [booking]);

  useEffect(loadSlots, [loadSlots]);

  if (loading) return <LoadingState />;
  if (!booking) return <ErrorState title="Booking not found" onRetry={loadBooking} />;

  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  const eligible =
    booking.status === "CONFIRMED" &&
    booking.rescheduleCount < MAX_CUSTOMER_RESCHEDULES &&
    hoursUntil >= CANCELLATION_FREE_WINDOW_HOURS;

  if (!eligible) {
    return (
      <ErrorState
        title="This booking can no longer be rescheduled"
        message="It may have changed since you opened this screen. Go back to see the latest status."
        onRetry={() => router.back()}
      />
    );
  }

  const currentScheduledAt = new Date(booking.scheduledAt);
  const currentDisplay = currentScheduledAt.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  function handleSelectSlot(slot: AvailableSlot) {
    const newDisplay = new Date(slot.startAt).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    Alert.alert(
      "Confirm reschedule",
      `Move this booking from:\n${currentDisplay}\n\nto:\n${newDisplay}\n\nYour price stays the same.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          style: "default",
          onPress: () => {
            void (async () => {
              if (!booking) return;
              setSubmitting(true);
              try {
                await rescheduleBooking(booking.id, slot.date, slot.startTime, generateIdempotencyKey());
                Alert.alert("Booking rescheduled", `Your booking is now set for ${newDisplay}.`, [
                  { text: "OK", onPress: () => router.back() },
                ]);
              } catch (err) {
                Alert.alert(
                  "Couldn't reschedule",
                  err instanceof Error ? err.message : "Something went wrong. Please try again.",
                );
                loadBooking();
                loadSlots();
              } finally {
                setSubmitting(false);
              }
            })();
          },
        },
      ],
    );
  }

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    (acc[slot.date] as AvailableSlot[]).push(slot);
    return acc;
  }, {});

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xs }}>Reschedule Booking</Text>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginBottom: spacing.xl }}>
        Currently: {currentDisplay} IST
      </Text>

      <Text style={sectionTitle}>Available Times</Text>
      {slotsLoading ? (
        <LoadingState fill={false} />
      ) : slotsError ? (
        <View style={{ marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.error, marginBottom: spacing.sm }}>{slotsError}</Text>
          <Button label="Retry" variant="secondary" onPress={loadSlots} />
        </View>
      ) : Object.keys(slotsByDate).length === 0 ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>No slots available in the next 14 days.</Text>
      ) : (
        Object.entries(slotsByDate).map(([date, daySlots]) => (
          <View key={date} style={{ marginBottom: spacing.lg }}>
            <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.sm }}>
              {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
              {daySlots.map((slot) => (
                <TouchableOpacity
                  key={slot.startAt}
                  disabled={submitting}
                  onPress={() => handleSelectSlot(slot)}
                  style={{
                    borderWidth: 1,
                    borderColor: colors.accent,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    opacity: submitting ? 0.5 : 1,
                  }}
                >
                  <Text style={{ ...typography.bodyMedium, color: colors.accent }}>{slot.startTime}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))
      )}

      <View style={{ height: spacing.xl }} />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} disabled={submitting} />
    </ScrollView>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;
