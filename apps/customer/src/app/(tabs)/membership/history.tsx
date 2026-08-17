import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import type { Membership } from "@autodeck/core";
import { getMyMemberships } from "../../../lib/membership-service";
import {
  colors,
  spacing,
  typography,
  Card,
  StatusBadge,
  statusTone,
  EmptyState,
  ErrorState,
  LoadingState,
  formatDateShort,
} from "@autodeck/ui";

export default function MembershipHistoryScreen() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMemberships(await getMyMemberships());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership history.");
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
        data={memberships}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, flexGrow: 1 }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={<EmptyState title="No memberships yet" fill={false} />}
        renderItem={({ item }) => (
          <Card flat>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary, textTransform: "capitalize" }}>{item.tier}</Text>
              <StatusBadge label={item.status} tone={statusTone(item.status)} />
            </View>
            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
              {item.startDate ? formatDateShort(item.startDate) : "Not started"}
              {item.endDate ? ` – ${formatDateShort(item.endDate)}` : ""}
            </Text>
          </Card>
        )}
      />
    </View>
  );
}
