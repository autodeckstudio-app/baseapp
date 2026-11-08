import { useReduceMotion } from "../../../lib/reduce-motion";
import { useState, useEffect, useRef } from "react";
import { View, Modal } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import { COLLECTIONS } from "@autodeck/database";
import { pickupsLostOnUpgrade, upgradePaysFullPrice, upgradePricePaise, washesLostOnUpgrade, type Membership, type MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { purchaseMembership, upgradeMembership, generateIdempotencyKey } from "../../../lib/membership-service";
import { listenToMyMemberships } from "../../../lib/home-service";
import { payWithPaymentLink } from "../../../lib/razorpay-checkout";
import { useAuth } from "../../../hooks/useAuth";
import { carryOverLine } from "../../../lib/membership-rules";
import { pickupsLine } from "../../../lib/membership-view";
import { membershipOnlinePayCopy, type OnlinePayOutcome } from "../../../lib/native-pay-core";
import { upgradeConfirmCopy } from "../../../lib/upgrade-copy";

export default function PurchaseMembershipScreen() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const router = useRouter();
  const reduce = useReduceMotion();
  const auth = useAuth();
  const { colors } = useExperienceTheme();
  const [plan, setPlan] = useState<MembershipPlan | null>(null);
  const [existing, setExisting] = useState<Membership | null>(null);
  const [active, setActive] = useState<Membership | null>(null);
  const [activePlan, setActivePlan] = useState<MembershipPlan | null>(null);
  const [askUpgrade, setAskUpgrade] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payOutcome, setPayOutcome] = useState<OnlinePayOutcome | null>(null);
  const [done, setDone] = useState<"online" | "studio" | null>(null);
  const idempotencyKey=useRef(generateIdempotencyKey());const purchaseBusy=useRef(false),generation=useRef(0);
  const scopeKey=JSON.stringify([planId,auth.status,auth.status==='ready'?auth.customerDocId:null,auth.status==='ready'?auth.user.uid:null,auth.status==='ready'?auth.claims.tenantId:null]);const scopeRef=useRef(scopeKey);scopeRef.current=scopeKey;
  useEffect(()=>{generation.current++;purchaseBusy.current=false;idempotencyKey.current=generateIdempotencyKey();setPurchasing(false);setDone(null);setPayOutcome(null);setError(null);setAskUpgrade(false);return()=>{generation.current++}},[scopeKey]);

  const uid = auth.status === "ready" ? auth.customerDocId : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  const [retryTick,setRetryTick] = useState(0);
  useEffect(() => {
    let alive=true;setPlan(null);setDone(null);setPayOutcome(null);setAskUpgrade(false);if (!planId) {setLoading(false);return;}
    setLoading(true);setError(null);
    void getDoc(doc(db, COLLECTIONS.membershipPlans(), planId))
      .then((snap) => {
        if (alive&&snap.exists()) setPlan(snap.data() as MembershipPlan);
      })
      .catch((err: unknown) => {
        if(alive)setError("Your plan could not load. Try again.");
      })
      .finally(() => {if(alive)setLoading(false)});return()=>{alive=false};
  }, [planId,retryTick]);

  // Live status: an existing pending request turns active here without a
  // reload once payment is confirmed.
  useEffect(() => {
    setExisting(null);setActive(null);if (!uid || !tenantId) return;let alive=true;
    const stop=listenToMyMemberships(
      tenantId,
      uid,
      (memberships) => {
        if(!alive)return;setExisting(memberships.find((m) => m.status === "pending") ?? memberships.find((m) => m.status === "active") ?? null);
        setActive(memberships.find((m) => m.status === "active") ?? null);
      },
      () => undefined,
    );return()=>{alive=false;stop()};
  }, [uid, tenantId]);

  // The plan being replaced, to price the upgrade.
  useEffect(() => {
    if (!active) { setActivePlan(null); return; }
    let alive = true;
    void getDoc(doc(db, COLLECTIONS.membershipPlans(), active.planId)).then((snap) => { if (alive) setActivePlan(snap.exists() ? (snap.data() as MembershipPlan) : null); }).catch(() => undefined);
    return () => { alive = false; };
  }, [active?.planId]);
  const upgradeQuote = plan && active && activePlan ? upgradePricePaise({ currentPlanPricePaise: activePlan.priceInPaise, newPlanPricePaise: plan.priceInPaise, washesUsed: active.washesUsed, pickupsUsed: active.pickupsUsed ?? 0 }) : null;
  const pendingIsUpgrade = existing?.status === "pending" && Boolean(existing.upgradeFromMembershipId);

  // Reachable only from the Confirm upgrade button in the pop-up.
  async function confirmUpgrade(method: "razorpay_payment_link" | "cash") {
    if (!plan || purchasing) return;
    if(purchaseBusy.current)return;
    const scope=scopeKey,gen=generation.current;const current=()=>scopeRef.current===scope&&generation.current===gen;purchaseBusy.current=true;
    setAskUpgrade(false);
    setPurchasing(true);
    setError(null);
    try {
      const result = await upgradeMembership(plan.id, method, idempotencyKey.current);
      if(!current())return;
      if (method === "razorpay_payment_link") {
        if (!result.paymentId) throw new Error("Payment is not ready. Please try again.");
        if (!result.paymentUrl) throw new Error("Your membership payment needs checking. Contact the studio before trying again; do not start another payment.");
        const outcome=await payWithPaymentLink(result.paymentId, result.paymentUrl);if(!current())return;setPayOutcome(outcome);
      }
      setDone(method === "cash" ? "studio" : "online");
    } catch (err) {
      if(current())setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      if(current()){purchaseBusy.current=false;setPurchasing(false);}
    }
  }

  async function handlePurchase(method: "razorpay_payment_link" | "cash") {
    if (!plan || purchasing) return;
    if(purchaseBusy.current)return;
    const scope=scopeKey,gen=generation.current;const current=()=>scopeRef.current===scope&&generation.current===gen;purchaseBusy.current=true;
    setPurchasing(true);
    setError(null);
    try {
      // A pending upgrade is paid again through the same call (the server replays it, never makes a second one).
      const result = pendingIsUpgrade ? await upgradeMembership(plan.id, method, idempotencyKey.current) : await purchaseMembership(plan.id, method, idempotencyKey.current);
      if(!current())return;
      if (method === "razorpay_payment_link") {
        if (!result.paymentId) throw new Error("Payment is not ready. Please try again.");
        if (!result.paymentUrl) throw new Error("Your membership payment needs checking. Contact the studio before trying again; do not start another payment.");
        const outcome=await payWithPaymentLink(result.paymentId, result.paymentUrl);if(!current())return;setPayOutcome(outcome);
      }
      setDone(method === "cash" ? "studio" : "online");
    } catch (err) {
      if(current())setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      if(current()){purchaseBusy.current=false;setPurchasing(false);}
    }
  }

  if (loading) return <Loading label="Preparing checkout" />;
  if (!plan) return <Screen><Notice title={error?"Could not load plan":"Plan unavailable"} body={error??"This plan may no longer be offered."} action={<Button label={error?"Retry":"See plans"} onPress={()=>error?setRetryTick(n=>n+1):router.replace("/(tabs)/membership")}/>} /></Screen>;

  if (active && !existing?.upgradeFromMembershipId && existing?.status !== "pending" && upgradeQuote !== null && !done) {
    const lost = washesLostOnUpgrade(active);
    const copy = upgradeConfirmCopy({ lostWashes: lost, lostPickups: pickupsLostOnUpgrade(active), tier: active.tier, newName: plan.name, priceLabel: rupees(upgradeQuote), fullPrice: upgradePaysFullPrice(active) });
    return (
      <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Upgrade</Kicker><T role="title">{plan.name}</T></View>}>
        <Pane pad="gap">
          <Row title="Included washes" detail={`${plan.includedWashes} / month`} />
          {pickupsLine(plan.freePickups) ? <Row title="Free pickups" detail={`${plan.freePickups} / month`} /> : null}
          {plan.prioritySlot ? <Row title="Priority slot" detail="Included" /> : null}
          <Row title="You pay now" detail={rupees(upgradeQuote)} last />
        </Pane>
        <T role="caption" tone="tertiary">Your {active.tier} plan ends when the upgrade is paid. Unused washes and pickups do not carry over. {upgradePaysFullPrice(active) ? "You have used part of this plan, so the full new price applies." : "Nothing used yet, so you pay only the difference."} The new plan runs 30 days from the day it starts.</T>
        {error ? <Notice title="Upgrade failed" body={error} /> : null}
        <Button label="Upgrade" busy={purchasing} onPress={() => setAskUpgrade(true)} />
        <Modal visible={askUpgrade} transparent animationType={reduce ? "none" : "fade"} onRequestClose={() => setAskUpgrade(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <View style={{ width: "100%", maxWidth: 420, borderRadius: 24, padding: 20, gap: 14, backgroundColor: colors.surface }}>
              <T role="heading">{copy.title}</T>
              <T tone="secondary">{copy.body}</T>
              <Button label={copy.confirm} onPress={() => void confirmUpgrade("razorpay_payment_link")} />
              <Button kind="quiet" label="Pay at studio instead" onPress={() => void confirmUpgrade("cash")} />
              <Button kind="quiet" label={copy.cancel} onPress={() => setAskUpgrade(false)} />
            </View>
          </View>
        </Modal>
      </Screen>
    );
  }

  if (existing?.status === "active") {
    return (
      <Screen>
        <Notice
          title="Membership active"
          body="Your membership is active and your benefits are unlocked."
          action={<Button label="View membership" onPress={() => router.replace("/(tabs)/membership")} />}
        />
      </Screen>
    );
  }

  if (done || existing?.status === "pending") {
    const isStudio = done === "studio";
    const payCopy = membershipOnlinePayCopy(payOutcome, active?.tier ?? null);
    return (
      <Screen>
        <Notice
          title={isStudio ? "Pay at the studio to activate" : payCopy.title}
          body={
            isStudio
              ? "Request saved. Pay at the studio front desk - benefits unlock once payment is confirmed. Unpaid requests are cancelled automatically."
              : payCopy.body
          }
          action={
            <View style={{ gap: space.hair }}>
              {!isStudio ? <Button label="Pay online" busy={purchasing} onPress={() => void handlePurchase("razorpay_payment_link")} /> : null}
              <Button label="View status" kind="quiet" onPress={() => router.replace("/(tabs)/membership")} />
              {error ? <T role="caption" tone="tertiary">{error}</T> : null}
            </View>
          }
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">{plan.tier}</Kicker>
          <T role="title">{plan.name}</T>
        </View>
      }
    >
      <Pane pad="gap">
        <Row title="Included washes" detail={`${plan.includedWashes} / month`} />
        {pickupsLine(plan.freePickups) ? <Row title="Free pickups" detail={`${plan.freePickups} / month`} /> : null}
        {plan.prioritySlot ? <Row title="Priority slot" detail="Included" /> : null}
        {plan.discountPercent > 0 ? <Row title="Discount" detail={`${plan.discountPercent}%`} /> : null}
        <Row title="Price" detail={`${rupees(plan.priceInPaise)} / month`} last />
      </Pane>

      <T role="caption" tone="tertiary">
        {[carryOverLine(), plan.discountPercent > 0 ? "Non-wash services receive the discount automatically at booking." : ""].filter(Boolean).join(" ")}
      </T>

      <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>
        Benefits unlock only after your payment is confirmed. Online payments activate automatically once verified; pay-at-studio requests are confirmed at the front desk.
      </T>

      {error ? <Notice title="Purchase failed" body={error} /> : null}

      <View style={{ gap: space.breath }}>
        <Button label="Pay online" busy={purchasing} onPress={() => void handlePurchase("razorpay_payment_link")} />
        <Button label="Pay at studio" kind="quiet" busy={purchasing} onPress={() => void handlePurchase("cash")} />
      </View>
    </Screen>
  );
}
