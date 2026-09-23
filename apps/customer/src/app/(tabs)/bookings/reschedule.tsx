import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getBookingById, getAvailability, rescheduleBooking, generateIdempotencyKey, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Booking } from "@autodeck/core";
import { MAX_CUSTOMER_RESCHEDULES, CANCELLATION_FREE_WINDOW_HOURS } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Kicker, Loading, Notice, Pane, Screen, T } from "../../../ui/kit";

export default function RescheduleBookingScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { colors } = useExperienceTheme();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<AvailableSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [doneLabel, setDoneLabel] = useState<string | null>(null);

  const loadBooking = useCallback(() => {
    if (!bookingId) return;
    setLoading(true);
    setLoadFailed(false);
    void getBookingById(bookingId)
      .then(setBooking)
      .catch(() => setLoadFailed(true))
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

  if (loading) return <Loading label="Opening your booking" />;
  if (loadFailed || !booking) {
    return (
      <Screen>
        <Notice title="Booking not found" body="Check your connection and try again." action={<Button label="Retry" onPress={loadBooking} />} />
      </Screen>
    );
  }

  const hoursUntil = (new Date(booking.scheduledAt).getTime() - Date.now()) / 3600000;
  const eligible =
    booking.status === "CONFIRMED" &&
    booking.rescheduleCount < MAX_CUSTOMER_RESCHEDULES &&
    hoursUntil >= CANCELLATION_FREE_WINDOW_HOURS;

  if (!eligible) {
    return (
      <Screen>
        <Notice
          title="This booking can no longer be rescheduled"
          body="It may have changed since you opened this screen. Go back to see the latest status."
          action={<Button label="Go back" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const currentScheduledAt = new Date(booking.scheduledAt);
  const formatSlot = (d: Date) =>
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  const currentDisplay = formatSlot(currentScheduledAt);

  async function handleConfirm() {
    if (!booking || !pendingSlot) return;
    const newDisplay = formatSlot(new Date(pendingSlot.startAt));
    setSubmitting(true);
    setActionError(null);
    try {
      await rescheduleBooking(booking.id, pendingSlot.date, pendingSlot.startTime, generateIdempotencyKey());
      setDoneLabel(newDisplay);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setPendingSlot(null);
      loadBooking();
      loadSlots();
    } finally {
      setSubmitting(false);
    }
  }

  if (doneLabel) {
    return (
      <Screen>
        <Notice
          title="Booking rescheduled"
          body={`Your booking is now set for ${doneLabel} IST.`}
          action={<Button label="Done" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    (acc[slot.date] as AvailableSlot[]).push(slot);
    return acc;
  }, {});

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Reschedule</Kicker>
          <T role="title">Pick a new time</T>
          <T role="caption" tone="secondary">Currently: {currentDisplay} IST</T>
        </View>
      }
    >
      {slotsLoading ? (
        <T role="caption" tone="tertiary">Checking the studio's calendar...</T>
      ) : slotsError ? (
        <Notice title="Can't load times" body={slotsError} action={<Button label="Retry" kind="quiet" onPress={loadSlots} />} />
      ) : Object.keys(slotsByDate).length === 0 ? (
        <Notice title="No free times" body="Nothing available in the next 14 days. Try again tomorrow or call the studio." />
      ) : (
        Object.entries(slotsByDate).map(([date, daySlots]) => (
          <Pane key={date} pad="gap">
            <View style={{ gap: space.line }}>
              <T role="heading">{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</T>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
                {daySlots.map((slot) => {
                  const selected = pendingSlot?.startAt === slot.startAt;
                  return (
                    <Pressable
                      key={slot.startAt}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      disabled={submitting}
                      onPress={() => setPendingSlot(slot)}
                      style={({ pressed }) => ({
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.accent,
                        backgroundColor: selected ? colors.accentHaze : "transparent",
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        opacity: submitting ? 0.4 : pressed ? 0.7 : 1,
                        minWidth: 76,
                        alignItems: "center",
                      })}
                    >
                      <T role="data" tone="accent">{slot.startTime}</T>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pane>
        ))
      )}

      {pendingSlot ? (
        <Notice
          title="Confirm reschedule"
          body={`Move this booking from ${currentDisplay} to ${formatSlot(new Date(pendingSlot.startAt))} IST. Your price stays the same.`}
          action={
            <View style={{ gap: space.breath }}>
              <Button label="Confirm new time" busy={submitting} onPress={() => void handleConfirm()} />
              <Button label="Keep looking" kind="quiet" onPress={() => setPendingSlot(null)} />
            </View>
          }
        />
      ) : null}

      {actionError ? <Notice title="Couldn't reschedule" body={actionError} /> : null}

      <Button label="Cancel" kind="quiet" disabled={submitting} onPress={() => router.back()} />
    </Screen>
  );
}
