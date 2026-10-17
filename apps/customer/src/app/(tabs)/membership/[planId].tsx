import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import type { MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { HeroImage, Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { carryOverLine } from "../../../lib/membership-rules";
import { pickupsLine } from "../../../lib/membership-view";
import { sceneImagery } from "../../../lib/imagery";

export default function PlanDetailScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [retryTick,setRetryTick] = useState(0);
  useEffect(() => {
    if (!planId) {setLoading(false);return;}
    setLoading(true);setError(null);setPlan(null);
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
  }, [planId,retryTick]);

  if (loading) return <Loading label="Opening plan" />;
  if (error) return <Screen><Notice title="Could not load plan" body={error} action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
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
      <Pane pad="none" round="hero" fill="cool" tone="premium">
        <HeroImage source={sceneImagery.membership} />
      </Pane>

      <Pane pad="gap">
        <Row title="Included washes" detail={`${plan.includedWashes} / month`} last={!pickupsLine(plan.freePickups) && !plan.prioritySlot && !(plan.discountPercent > 0)} />
        {pickupsLine(plan.freePickups) ? <Row title="Free pickups" detail={`${plan.freePickups} / month`} last={!plan.prioritySlot && !(plan.discountPercent > 0)} /> : null}
        {plan.prioritySlot ? <Row title="Priority slot" detail="Included" last={!(plan.discountPercent > 0)} /> : null}
        {plan.discountPercent > 0 ? <Row title="Discount on other services" detail={`${plan.discountPercent}%`} last /> : null}
      </Pane>

      <T role="caption" tone="tertiary">
        {[carryOverLine(), plan.discountPercent > 0 ? "Non-wash services receive the discount automatically at booking." : ""].filter(Boolean).join(" ")}
      </T>

      <Button
        label="Join this plan"
        onPress={() => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: plan.id } })}
      />
    </Screen>
  );
}
