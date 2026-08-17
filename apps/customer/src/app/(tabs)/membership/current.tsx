import { View, Text, ScrollView } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import type { Membership } from "@autodeck/core";
import { getMyMemberships } from "../../../lib/membership-service";
import {
  colors,
  spacing,
  radius,
  typography,
  Button,
  StatusBadge,
  statusTone,
  ListRow,
  Divider,
  EmptyState,
  ErrorState,
  LoadingState,
  formatDateShort,
} from "@autodeck/ui";

export default function CurrentMembershipScreen() {
  const router = useRouter();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memberships = await getMyMemberships();
      setMembership(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;
  if (!membership) {
    return (
      <EmptyState
        title="No active membership"
        message="Join a plan to start saving on your services."
        actionLabel="Browse Plans"
        onAction={() => router.push("/(tabs)/membership")}
      />
    );
  }

  const washesRemaining = Math.max(0, membership.washesTotal - membership.washesUsed);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg }}>
        <Text style={{ ...typography.heading, color: colors.textPrimary, textTransform: "capitalize" }}>{membership.tier}</Text>
        <StatusBadge label={membership.status} tone={statusTone(membership.status)} />
      </View>

      {membership.status === "pending" && (
        <View style={{ backgroundColor: colors.warningMuted, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.caption, color: colors.warning }}>
            Awaiting payment confirmation from the studio.
          </Text>
        </View>
      )}

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
        <ListRow label="Washes remaining" value={`${washesRemaining} / ${membership.washesTotal}`} />
        <Divider spacingY="xs" />
        <ListRow label="Discount on other services" value={`${membership.discountPercent}%`} />
        {membership.startDate && (
          <>
            <Divider spacingY="xs" />
            <ListRow label="Started" value={formatDateShort(membership.startDate)} />
          </>
        )}
        {membership.endDate && (
          <>
            <Divider spacingY="xs" />
            <ListRow label="Renews / Expires" value={formatDateShort(membership.endDate)} />
          </>
        )}
      </View>

      <Button label="View Usage" onPress={() => router.push("/(tabs)/membership/usage")} variant="secondary" />
      <View style={{ height: spacing.sm }} />
      <Button label="Membership History" onPress={() => router.push("/(tabs)/membership/history")} variant="ghost" />
    </ScrollView>
  );
}
