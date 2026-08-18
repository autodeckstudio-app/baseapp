import { View, Text } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";

export type StatusTone = "neutral" | "accent" | "success" | "warning" | "error";

const TONE_STYLES: Record<StatusTone, { bg: string; fg: string }> = {
  neutral: { bg: colors.surfaceSunken, fg: colors.textSecondary },
  accent: { bg: colors.accentMuted, fg: colors.accentPressed },
  success: { bg: colors.successMuted, fg: colors.success },
  warning: { bg: colors.warningMuted, fg: colors.warning },
  error: { bg: colors.errorMuted, fg: colors.error },
};

export interface StatusBadgeProps {
  label: string;
  tone?: StatusTone;
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  const t = TONE_STYLES[tone];
  return (
    <View
      style={{
        backgroundColor: t.bg,
        borderRadius: radius.full,
        paddingHorizontal: spacing.sm + 2,
        paddingVertical: spacing.xxs + 1,
        alignSelf: "flex-start",
      }}
    >
      <Text style={{ ...typography.label, color: t.fg, letterSpacing: 0.2 }}>{label}</Text>
    </View>
  );
}

// Centralised status → tone mapping so every screen renders the same
// domain status with the same colour, without each screen re-deriving it.
// Keys cover BookingStatus, JobStatus, PaymentStatus, InvoiceStatus, and
// MembershipStatus —
// unioned into one map is safe because overlapping names (e.g. "CANCELLED")
// share the same intended tone across domains.
const STATUS_TONES: Record<string, StatusTone> = {
  // Booking
  PENDING: "warning",
  CONFIRMED: "accent",
  ACTIVE: "accent",
  COMPLETED: "success",
  CANCELLED: "neutral",
  EXPIRED: "neutral",
  // Job
  PENDING_VEHICLE: "warning",
  VEHICLE_RECEIVED: "accent",
  IN_PROGRESS: "accent",
  QUALITY_CHECK: "warning",
  READY_FOR_DELIVERY: "success",
  DELIVERED: "success",
  // Payment (lowercase)
  pending: "warning",
  processing: "accent",
  completed: "success",
  failed: "error",
  cancelled: "neutral",
  refunded: "neutral",
  // Invoice
  draft: "neutral",
  issued: "accent",
  paid: "success",
  void: "neutral",
  // Membership (lowercase; distinct from Booking's uppercase ACTIVE/EXPIRED)
  active: "success",
  expired: "neutral",
  // Protection
  verified: "success",
  unverified: "warning",
  // Approval (pending/expired/cancelled reuse the tones above)
  approved: "success",
  rejected: "error",
};

export function statusTone(status: string): StatusTone {
  return STATUS_TONES[status] ?? "neutral";
}
