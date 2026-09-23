import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.membershipPlans(), planId));
        if (snap.exists()) setPlan(snap.data() as MembershipPlan);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load plan.");
      } finally {
        setLoading(false);
      }
    })();
  }, [planId]);

  if (loading) return <Loading label="Opening plan" />;
  if (error) return <Screen><Notice title="Could not load plan" body={error} /></Screen>;
  if (!plan) return <Screen><Notice title="Plan not found" body="It may no longer be available." /></Screen>;

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">{plan.tier}</Kicker>
          <T role="title">{plan.name}</T>
          <T role="display">
            {rupees(plan.priceInPaise)}
            <T role="body" tone="tertiary"> / month</T>
          </T>
        </View>
      }
    >
      <Pane pad="gap">
        <Row title="Included washes" detail={`${plan.includedWashes} / month`} />
        <Row title="Discount on other services" detail={`${plan.discountPercent}%`} last />
      </Pane>

      <T role="caption" tone="tertiary">
        Washes reset each billing cycle and do not roll over. Non-wash services receive the discount automatically at booking.
      </T>

      <Button
        label="Join this plan"
        onPress={() => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: plan.id } })}
      />
    </Screen>
  );
}
