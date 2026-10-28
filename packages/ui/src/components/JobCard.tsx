import { View, Text, Platform } from "react-native";
import type { ViewStyle } from "react-native";
import { floatCard } from "../theme/float.js";
import { isNightPalette } from "../tokens/colors.js";
import { visitTiming } from "@autodeck/core";
import { useMinuteNow } from "../clock/useMinuteNow.js";
import type { ServiceJob } from "@autodeck/core";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";
import { Card } from "./Card.js";
import { StatusBadge, statusTone } from "./StatusBadge.js";
import { formatTime } from "../format.js";
import { shortDate } from "./shortDate";

const JOB_STATUS_LABELS: Record<string, string> = {
  STANDBY: "Arrived - standby",
  PENDING_VEHICLE: "Awaiting vehicle",
  VEHICLE_RECEIVED: "Vehicle in",
  IN_PROGRESS: "In progress",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export function jobStatusLabel(status: string): string {
  return JOB_STATUS_LABELS[status] ?? status;
}

export interface JobCardProps {
  bayName?: string | undefined;
  serviceName?: string | undefined;
  // Who and what: shown first so staff can tell cars apart at a glance.
  carName?: string | undefined;
  customerName?: string | undefined;
  job: ServiceJob;
  onPress?: () => void;
  // The date this card is being shown under (e.g. the Calendar's selected
  // day) - when it differs from job.scheduledDate, the job started on an
  // earlier day and is still running (a multi-day service), so the card
  // shows "started {date}" instead of a same-day start time.
  viewDate?: string;
}

/** Dense job summary for the studio app's Today's Jobs / Calendar lists. */
export function JobCard({ job, onPress, viewDate, bayName, serviceName, carName, customerName }: JobCardProps) {
  const isMultiDay = job.scheduledDate !== job.estimatedEndDate;
  const isOngoingFromEarlierDay = viewDate !== undefined && viewDate !== job.scheduledDate;
  // Where the visit stands against its planned time. Display only; an unarrived or overrunning job stays listed.
  const timing = visitTiming(job, useMinuteNow());

  return (
    <Card onPress={onPress} padding="md" flat style={Platform.OS === "web" ? (floatCard(isNightPalette) as unknown as ViewStyle) : undefined}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
        <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
          {job.status === "STANDBY" ? `Waiting since ${formatTime(job.standbyArrivedAt ?? job.createdAt)}` : isOngoingFromEarlierDay ? `Started ${shortDate(job.scheduledDate)}` : formatTime(job.scheduledAt)}
        </Text>
        <StatusBadge label={JOB_STATUS_LABELS[job.status] ?? job.status} tone={statusTone(job.status)} />
      </View>
      {carName ? <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }} numberOfLines={1}>{carName}</Text> : null}
      {customerName ? <Text style={{ ...typography.caption, color: colors.textSecondary }} numberOfLines={1}>{customerName}</Text> : null}
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>{serviceName ? `${serviceName} · ` : ""}{job.status === "STANDBY" ? "No bay reserved" : bayName ?? "Bay"}</Text>
      {timing.phase !== "closed" && !(job.status === "STANDBY") ? (
        <View style={{ flexDirection: "row", marginTop: spacing.xs }}>
          <StatusBadge label={timing.label} tone={timing.tone} />
        </View>
      ) : null}
      <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs }}>
        {job.isWalkIn && <Tag label="WALK-IN" />}
        {isMultiDay && <Tag label={`MULTI-DAY · until ${shortDate(job.estimatedEndDate)}`} />}
      </View>
    </Card>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: colors.accentMuted,
        borderRadius: radius.sm,
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
      }}
    >
      <Text style={{ ...typography.label, color: colors.accentPressed }}>{label}</Text>
    </View>
  );
}

