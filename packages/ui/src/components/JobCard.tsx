import { View, Text } from "react-native";
import type { ServiceJob } from "@autodeck/core";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";
import { Card } from "./Card.js";
import { StatusBadge, statusTone } from "./StatusBadge.js";
import { formatTime } from "../format.js";

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Awaiting vehicle",
  VEHICLE_RECEIVED: "Vehicle in",
  IN_PROGRESS: "In progress",
  QUALITY_CHECK: "Quality check",
  READY_FOR_DELIVERY: "Ready",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export interface JobCardProps {
  job: ServiceJob;
  onPress?: () => void;
  // The date this card is being shown under (e.g. the Calendar's selected
  // day) — when it differs from job.scheduledDate, the job started on an
  // earlier day and is still running (a multi-day service), so the card
  // shows "started {date}" instead of a same-day start time.
  viewDate?: string;
}

/** Dense job summary for the studio app's Today's Jobs / Calendar lists. */
export function JobCard({ job, onPress, viewDate }: JobCardProps) {
  const isMultiDay = job.scheduledDate !== job.estimatedEndDate;
  const isOngoingFromEarlierDay = viewDate !== undefined && viewDate !== job.scheduledDate;

  return (
    <Card onPress={onPress} padding="md">
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xs }}>
        <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
          {isOngoingFromEarlierDay ? `Started ${job.scheduledDate}` : formatTime(job.scheduledAt)}
        </Text>
        <StatusBadge label={JOB_STATUS_LABELS[job.status] ?? job.status} tone={statusTone(job.status)} />
      </View>
      <Text style={{ ...typography.caption, color: colors.textSecondary }}>Bay: {job.bayId}</Text>
      <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.xs }}>
        {job.isWalkIn && <Tag label="WALK-IN" />}
        {isMultiDay && <Tag label={`MULTI-DAY · until ${job.estimatedEndDate}`} />}
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
