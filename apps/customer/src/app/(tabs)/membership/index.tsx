import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { useRouter } from "expo-router";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { getMembershipPlans, getMyMemberships } from "../../../lib/membership-service";
import {
  colors,
  spacing,
  typography,
  StatusBadge,
  statusTone,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  formatPaise,
} from "@autodeck/ui";

export default function MembershipScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, memberships] = await Promise.all([getMembershipPlans(), getMyMemberships()]);
      setPlans(plansData);
      setCurrent(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership plans.");
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
      {current && (
        <Card
          onPress={() => router.push("/(tabs)/membership/current")}
          style={{ margin: spacing.lg, marginBottom: spacing.sm }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>Your Membership</Text>
              <Text style={{ ...typography.title, color: colors.textPrimary, marginTop: spacing.xxs, textTransform: "capitalize" }}>
                {current.tier}
              </Text>
            </View>
            <StatusBadge label={current.status} tone={statusTone(current.status)} />
          </View>
        </Card>
      )}

      <FlatList
        data={plans}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: spacing.lg, paddingTop: current ? spacing.sm : spacing.lg, flexGrow: 1 }}
        ListHeaderComponent={
          <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.md }}>
            {current ? "Other Plans" : "Membership Plans"}
          </Text>
        }
        ListEmptyComponent={<EmptyState title="No plans available" message="Check back soon." fill={false} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        renderItem={({ item }) => (
          <Card onPress={() => router.push(`/(tabs)/membership/${item.id}`)}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ ...typography.title, color: colors.textPrimary }}>{item.name}</Text>
                <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                  {item.includedWashes} washes · {item.discountPercent}% off other services
                </Text>
              </View>
              <Text style={{ ...typography.price, color: colors.accent }}>{formatPaise(item.priceInPaise)}</Text>
            </View>
          </Card>
        )}
      />
    </View>
  );
}
