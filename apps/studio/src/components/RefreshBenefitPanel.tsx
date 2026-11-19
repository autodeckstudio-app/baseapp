import { View, Text } from "react-native";
import { Button, colors, radius, spacing, typography } from "@autodeck/ui";
import type { RefreshVisitState } from "../lib/membership-refresh";

/**
 * Studio visit surface for the Platinum interior refresh benefit: balance
 * readout plus the staff recording action. Display logic only - recording
 * authority and idempotency are enforced by recordMembershipRefresh.
 */
export function RefreshBenefitPanel(p: {
  used: number;
  total: number;
  state: RefreshVisitState;
  recording: boolean;
  onRecord: () => void;
}) {
  if (p.state === "unavailable") return null;
  return (
    <View
      style={{
        backgroundColor: colors.accentMuted,
        borderRadius: radius.lg,
        padding: spacing.md,
        marginBottom: spacing.lg,
        gap: spacing.xs,
      }}
    >
      <Text style={{ ...typography.caption, color: colors.accentPressed }}>
        Interior refresh: {p.used} of {p.total} used
      </Text>
      {p.state === "recorded" ? (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>Recorded for this visit.</Text>
      ) : p.state === "recordable" ? (
        <Button
          label="Record interior refresh"
          accessibilityLabel="Record the included interior refresh for this visit"
          variant="secondary"
          loading={p.recording}
          onPress={p.onRecord}
        />
      ) : (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>All refreshes used this term.</Text>
      )}
    </View>
  );
}
