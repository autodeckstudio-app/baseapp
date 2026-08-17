import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { COLLECTIONS } from "@autodeck/database";
import type { MembershipPlan } from "@autodeck/core";
import { purchaseMembership, generateIdempotencyKey } from "../../../lib/membership-service";
import { colors, spacing, radius, typography, Button, ListRow, LoadingState, formatPaise } from "@autodeck/ui";

export default function PurchaseMembershipScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!planId) return;
    void getDoc(doc(db, COLLECTIONS.membershipPlans(), planId))
      .then((snap) => {
        if (snap.exists()) setPlan(snap.data() as MembershipPlan);
      })
      .catch((err: unknown) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Could not load plan.");
      })
      .finally(() => setLoading(false));
  }, [planId]);

  async function handlePurchase() {
    if (!plan) return;
    setPurchasing(true);
    try {
      await purchaseMembership(plan.id, "razorpay_payment_link", idempotencyKey);
      Alert.alert(
        "Request received",
        "Your membership will be activated once payment is confirmed by the studio.",
      );
      router.replace("/(tabs)/membership");
    } catch (err) {
      Alert.alert("Purchase failed", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!plan) return null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginBottom: spacing.xl }}>Confirm Purchase</Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
        <ListRow label="Plan" value={plan.name} />
        <ListRow label="Included washes" value={`${plan.includedWashes} / month`} />
        <ListRow label="Discount" value={`${plan.discountPercent}%`} />
        <ListRow label="Price" value={`${formatPaise(plan.priceInPaise)} / month`} />
      </View>

      <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", marginBottom: spacing.xl }}>
        Payment is confirmed by the studio before your membership is activated.
      </Text>

      <Button label="Confirm & Pay" onPress={() => void handlePurchase()} loading={purchasing} />
      <View style={{ height: spacing.sm }} />
      <Button label="Go back" onPress={() => router.back()} variant="ghost" />
    </ScrollView>
  );
}
