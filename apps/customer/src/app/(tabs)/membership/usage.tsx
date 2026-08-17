import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import type { MembershipUsage } from "@autodeck/core";
import { getMyMemberships, getMembershipUsage } from "../../../lib/membership-service";
import { colors, spacing, typography, Card, EmptyState, ErrorState, LoadingState, formatPaise, formatDateShort } from "@autodeck/ui";

export default function MembershipUsageScreen() {
  const [usage, setUsage] = useState<MembershipUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memberships = await getMyMemberships();
      const current = memberships.find((m) => m.status === "active" || m.status === "pending");
      if (!current) {
        setUsage([]);
        return;
      }
      setUsage(await getMembershipUsage(current.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => void load()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={usage}
        keyExtractor={(u) => u.id}
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<EmptyState title="No usage yet" message="Book a wash or service to see it here." fill={false} />}
        renderItem={({ item }) => (
          <Card flat>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary, textTransform: "capitalize" }}>
                {item.usageType === "wash" ? "Wash credit used" : "Discount applied"}
              </Text>
              <Text style={{ ...typography.bodyMedium, color: colors.accent }}>{formatPaise(item.valueRedeemed)}</Text>
            </View>
            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
              {formatDateShort(item.usedAt)}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}
