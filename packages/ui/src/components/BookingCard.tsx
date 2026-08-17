import { View, Text } from "react-native";
import type { Booking } from "@autodeck/core";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";
import { Card } from "./Card.js";
import { StatusBadge, statusTone } from "./StatusBadge.js";
import { formatPaise, formatDateShort } from "../format.js";

const BOOKING_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  ACTIVE: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

export interface BookingCardProps {
  booking: Booking;
  onPress?: () => void;
}

export function BookingCard({ booking, onPress }: BookingCardProps) {
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm }}>
        <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
          {formatDateShort(booking.scheduledDate)} · {booking.scheduledTime}
        </Text>
        <StatusBadge label={BOOKING_STATUS_LABELS[booking.status] ?? booking.status} tone={statusTone(booking.status)} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "capitalize" }}>
          {booking.paymentStatus}
        </Text>
        <Text style={{ ...typography.priceSmall, color: colors.textPrimary }}>{formatPaise(booking.totalAmount)}</Text>
      </View>
    </Card>
  );
}
