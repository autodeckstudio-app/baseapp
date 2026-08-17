import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { MembershipPlan } from "@autodeck/core";
import { colors, spacing, radius, typography, Button, ListRow, Divider, LoadingState, ErrorState, formatPaise } from "@autodeck/ui";

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!planId) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.membershipPlans(), planId));
        if (snap.exists()) setPlan(snap.data() as MembershipPlan);
      } catch (err) {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load plan.");
      } finally {
        setLoading(false);
      }
    })();
  }, [planId]);

  if (loading) return <LoadingState />;
  if (!plan) return <ErrorState title="Plan not found" />;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.label, color: colors.accent }}>{plan.tier.toUpperCase()}</Text>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.xxs }}>{plan.name}</Text>
      <Text style={{ ...typography.price, color: colors.textPrimary, marginTop: spacing.md }}>
        {formatPaise(plan.priceInPaise)}
        <Text style={{ ...typography.body, color: colors.textMuted }}> / month</Text>
      </Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl }}>
        <ListRow label="Included washes" value={`${plan.includedWashes} / month`} />
        <Divider spacingY="xs" />
        <ListRow label="Discount on other services" value={`${plan.discountPercent}%`} />
      </View>

      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.lg }}>
        Washes reset each billing cycle and do not roll over. Non-wash services receive the discount
        automatically at booking.
      </Text>

      <View style={{ height: spacing.xl }} />
      <Button
        label="Join This Plan"
        onPress={() => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: plan.id } })}
      />
    </ScrollView>
  );
}
