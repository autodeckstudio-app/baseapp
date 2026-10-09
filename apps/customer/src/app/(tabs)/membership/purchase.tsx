import { useState, useEffect } from "react";
import { View, Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { purchaseMembership, generateIdempotencyKey } from "../../../lib/membership-service";
import { listenToMyMemberships } from "../../../lib/home-service";
import { useAuth } from "../../../hooks/useAuth";

export default function PurchaseMembershipScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const auth = useAuth();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [existing, setExisting] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<"online" | "studio" | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());

  const uid = auth.status === "ready" ? auth.user.uid : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  const [retryTick,setRetryTick] = useState(0);
  useEffect(() => {
    if (!planId) {setLoading(false);return;}
    setLoading(true);setError(null);
    void getDoc(doc(db, COLLECTIONS.membershipPlans(), planId))
      .then((snap) => {
        if (snap.exists()) setPlan(snap.data() as MembershipPlan);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Could not load plan.");
      })
      .finally(() => setLoading(false));
  }, [planId,retryTick]);

  // Live status: an existing pending request turns active here without a
  // reload once payment is confirmed.
  useEffect(() => {
    if (!uid || !tenantId) return;
    return listenToMyMemberships(
      tenantId,
      uid,
      (memberships) => {
        setExisting(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
      },
      () => undefined,
    );
  }, [uid, tenantId]);

  async function handlePurchase(method: "razorpay_payment_link" | "cash") {
    if (!plan || purchasing) return;
    setPurchasing(true);
    setError(null);
    try {
      const result = await purchaseMembership(plan.id, method, idempotencyKey);
      if (method === "razorpay_payment_link" && result.paymentUrl) {
        void Linking.openURL(result.paymentUrl).catch(() => undefined);
      }
      setDone(method === "cash" ? "studio" : "online");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) return <Loading label="Preparing checkout" />;
  if (!plan) return <Screen><Notice title={error?"Could not load plan":"Plan unavailable"} body={error??"This plan may no longer be offered."} action={<Button label={error?"Retry":"See plans"} onPress={()=>error?setRetryTick(n=>n+1):router.replace("/(tabs)/membership")}/>} /></Screen>;

  if (existing?.status === "active") {
    return (
      <Screen>
        <Notice
          title="Membership active"
          body="Your membership is active and your benefits are unlocked."
          action={<Button label="View membership" onPress={() => router.replace("/(tabs)/membership/current")} />}
        />
      </Screen>
    );
  }

  if (done || existing?.status === "pending") {
    const isStudio = done === "studio";
    return (
      <Screen>
        <Notice
          title={isStudio ? "Pay at the studio to activate" : "Almost done"}
          body={
            isStudio
              ? "Your request is saved. Pay at the studio front desk - your benefits unlock as soon as your payment is confirmed. Requests not paid within 48 hours are cancelled automatically."
              : "Complete the payment in the page that opened. Your membership activates automatically as soon as the payment is verified - no studio approval needed. Benefits stay locked until then."
          }
          action={<Button label="View status" onPress={() => router.replace("/(tabs)/membership/current")} />}
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
        Benefits unlock only after your payment is confirmed. Online payments activate automatically once verified; pay-at-studio requests are confirmed at the front desk.
      </T>

      {error ? <Notice title="Purchase failed" body={error} /> : null}

      <View style={{ gap: space.breath }}>
        <Button label="Pay online" busy={purchasing} onPress={() => void handlePurchase("razorpay_payment_link")} />
        <Button label="Pay at studio" kind="quiet" busy={purchasing} onPress={() => void handlePurchase("cash")} />
        <Button label="Go back" kind="quiet" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
