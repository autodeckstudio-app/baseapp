import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { purchaseMembership, generateIdempotencyKey } from "../../../lib/membership-service";

export default function PurchaseMembershipScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  useEffect(() => {
    if (!planId) return;
    void getDoc(doc(db, COLLECTIONS.membershipPlans(), planId))
      .then((snap) => {
        if (snap.exists()) setPlan(snap.data() as MembershipPlan);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load plan.");
      })
      .finally(() => setLoading(false));
  }, [planId]);

  async function handlePurchase() {
    if (!plan) return;
    setPurchasing(true);
    setError(null);
    try {
      await purchaseMembership(plan.id, "razorpay_payment_link", idempotencyKey);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) return <Loading label="Preparing checkout" />;
  if (!plan) return <Screen>{error ? <Notice title="Could not load plan" body={error} /> : null}</Screen>;

  if (done) {
    return (
      <Screen>
        <Notice
          title="Request received"
          body="Your membership will be activated once payment is confirmed by the studio."
          action={<Button label="Back to membership" onPress={() => router.replace("/(tabs)/membership")} />}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Confirm purchase</Kicker>
          <T role="title">{plan.name}</T>
        </View>
      }
    >
      <Pane pad="gap">
        <Row title="Included washes" detail={`${plan.includedWashes} / month`} />
        <Row title="Discount" detail={`${plan.discountPercent}%`} />
        <Row title="Price" detail={`${rupees(plan.priceInPaise)} / month`} last />
      </Pane>

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        Payment is confirmed by the studio before your membership is activated.
      </T>

      {error ? <Notice title="Purchase failed" body={error} /> : null}

      <View style={{ gap: space.breath }}>
        <Button label="Confirm & pay" busy={purchasing} onPress={() => void handlePurchase()} />
        <Button label="Go back" kind="quiet" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
