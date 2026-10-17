import { metrics } from "../../../lib/metrics";
import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, PageHeader, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { getMembershipPlans, getMembershipUsage } from "../../../lib/membership-service";
import { PlanCompare } from "../../../ui/PlanCompare";
import { MembershipCard } from "../../../ui/MembershipCard";
import { compareCols, valueRedeemed } from "../../../lib/membership-view";
import { MEMBERSHIP_WASH_LIVE, todayInIndia } from "../../../lib/membership-wash";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { listenToMyMemberships } from "../../../lib/home-service";
import { useAuth } from "../../../hooks/useAuth";

export default function MembershipScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<ReturnType<typeof valueRedeemed> | null>(null);
  const [ended, setEnded] = useState<Membership | null>(null);
  const [washIds, setWashIds] = useState<string[]>([]);

  const uid = auth.status === "ready" ? auth.user.uid : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setError(null);
    try {
      setPlans(await getMembershipPlans());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership plans.");
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  // Live membership status: approvals, payment activation, cancellation and
  // expiry appear here without a reload.
  useEffect(() => {
    if (!uid || !tenantId) return;
    setMembershipsLoading(true);
    return listenToMyMemberships(
      tenantId,
      uid,
      (memberships) => {
        setCurrent(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
        setEnded(memberships.filter((m) => m.status === "expired").sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0] ?? null);
        setMembershipsLoading(false);
      },
      (e) => {
        setError(e.message);
        setMembershipsLoading(false);
      },
    );
  }, [uid, tenantId]);

  const currentId = current?.status === "active" ? current.id : null;
  useEffect(() => {
    if (!currentId) { setRedeemed(null); return; }
    let alive = true;
    void getMembershipUsage(currentId).then((u) => { if (alive) setRedeemed(valueRedeemed(u)); }).catch(() => { if (alive) setRedeemed(null); });
    return () => { alive = false; };
  }, [currentId]);
  // The "book with my membership" button exists only once the server records included washes (see lib/membership-wash.ts).
  useEffect(() => {
    if (!MEMBERSHIP_WASH_LIVE || !currentId) return;
    void getServiceCatalogue().then((all) => setWashIds(all.filter((x) => x.membershipWashEligible === true).map((x) => x.id))).catch(() => undefined);
  }, [currentId]);

  const loading = plansLoading || membershipsLoading;
  if (loading) return <Loading label="Opening membership" />;
  if (error) {
    return (
      <Screen>
        <Notice
          title="Could not load membership"
          body={error}
          action={<Button kind="quiet" label="Retry" onPress={()=>void loadPlans()}/>}
        />
      </Screen>
    );
  }

  const cols = compareCols(plans, current?.planId ?? null);
  const today = todayInIndia();
  const active = current?.status === "active";
  const rupeesOf = (paise: number) => rupees(paise);

  return (
    <Screen
      header={
        <PageHeader kicker="Membership" title={current ? "Your membership" : "Regular washes at a better rate"} sub={current ? null : "Pick a plan and pay online."} />
      }
    >
      {current ? (
        <>
          <MembershipCard membership={current} today={today} />
          {active && redeemed && redeemed.total > 0 ? (
            <Pane pad="gap">
              <Row title="Value used so far" detail={`${rupeesOf(redeemed.total)} · ${redeemed.washes} wash${redeemed.washes === 1 ? "" : "es"}${redeemed.discountValue > 0 ? ` and ${rupeesOf(redeemed.discountValue)} off other services` : ""}`} last />
            </Pane>
          ) : null}
          <View style={{ gap: space.breath }}>
            {active && MEMBERSHIP_WASH_LIVE && washIds.length > 0 ? (
              <Button label="Book a wash with my plan" onPress={() => router.push(washIds.length === 1 ? `/(tabs)/catalogue/${washIds[0]}` : "/(tabs)/catalogue")} />
            ) : null}
            {current.status === "pending" && current.planId ? <Button label="Pay online" onPress={() => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: current.planId } })} /> : null}
            <Button label="Usage and history" kind="quiet" onPress={() => router.push("/(tabs)/membership/usage")} />
          </View>
        </>
      ) : (
        <>
          {ended ? (
            <Pane pad="gap" tone="premium" fill="cool">
              <Row title={`Your ${ended.tier} membership ended`} detail={ended.endDate ? `Ended ${new Date(ended.endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}` : "Ended"} last />
              {ended.planId ? <View style={{ padding: metrics.cardPad }}><Button label={`Renew ${ended.tier}`} onPress={() => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: ended.planId } })} /></View> : null}
            </Pane>
          ) : null}
        </>
      )}

      {cols.length === 0 ? (
        <Notice title="No plans available" body="Check back soon." />
      ) : (
        <View style={{ gap: space.line }}>
          <Kicker>{current ? "Plans" : "Compare plans"}</Kicker>
          <PlanCompare cols={cols} onOpen={(id) => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: id } })} />
        </View>
      )}
    </Screen>
  );
}
