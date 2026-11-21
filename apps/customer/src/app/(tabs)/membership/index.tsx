import { useExperienceTheme } from "@autodeck/ui/native";
import { serviceActionSurface } from "../../../lib/service-action-surface";
import { metrics } from "../../../lib/metrics";
import { useState, useEffect, useCallback, useRef } from "react";
import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, PageHeader, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { getMembershipPlans, getMembershipUsage } from "../../../lib/membership-service";
import { PlanCompare } from "../../../ui/PlanCompare";
import { MembershipCard } from "../../../ui/MembershipCard";
import { compareCols, reconcileRedeemed, valueRedeemed } from "../../../lib/membership-view";
import { MEMBERSHIP_WASH_LIVE, todayInIndia } from "../../../lib/membership-wash";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { listenToMyMemberships } from "../../../lib/home-service";
import { useAuth } from "../../../hooks/useAuth";

export default function MembershipScreen() {
  const { name, colors } = useExperienceTheme();
  const hubAction = (label: string, onPress: () => void, primary = false) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={{ flex: 1, minWidth: 0, minHeight: 44, justifyContent: "center" }}>
      {({ pressed }) => (
        <View pointerEvents="none" style={{
          ...serviceActionSurface(name, false, pressed),
          minHeight: 36, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10,
          borderColor: primary ? colors.borderStrong : colors.borderSubtle,
          backgroundColor: primary ? colors.surface : "transparent",
          alignItems: "center", justifyContent: "center",
        }}>
          <Text style={{ fontSize: 11, lineHeight: 15, fontWeight: primary ? "600" : "500", color: colors.textPrimary, textAlign: "center" }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
  const router = useRouter();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const originBack = returnTo === "home" ? () => router.navigate("/(tabs)") : undefined;
  const auth = useAuth();
  const [retryTick,setRetryTick]=useState(0);const planGeneration=useRef(0);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemed, setRedeemed] = useState<ReturnType<typeof valueRedeemed> | null>(null);
  const [ended, setEnded] = useState<Membership | null>(null);
  const [washIds, setWashIds] = useState<string[]>([]);

  const uid = auth.status === "ready" ? auth.customerDocId : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  const loadPlans = useCallback(async () => {
    const gen=++planGeneration.current;setPlansLoading(true);
    setError(null);
    try {
      const rows=await getMembershipPlans();if(gen===planGeneration.current)setPlans(rows);
    } catch (err) {
      if(gen===planGeneration.current)setError(err instanceof Error ? err.message : "Could not load membership plans.");
    } finally {
      if(gen===planGeneration.current)setPlansLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();return()=>{planGeneration.current++};
  }, [loadPlans,retryTick]);

  // Live membership status: approvals, payment activation, cancellation and
  // expiry appear here without a reload.
  useEffect(() => {
    setError(null);setCurrent(null);setEnded(null);setRedeemed(null);setWashIds([]);if (!uid || !tenantId) {setMembershipsLoading(false);return;}let alive=true;
    setMembershipsLoading(true);
    const stop=listenToMyMemberships(
      tenantId,
      uid,
      (memberships) => {
        if(!alive)return;setCurrent(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
        setEnded(memberships.filter((m) => m.status === "expired").sort((a, b) => (b.endDate ?? "").localeCompare(a.endDate ?? ""))[0] ?? null);
        setMembershipsLoading(false);
      },
      (e) => {
        if(!alive)return;setError("Your membership could not load. Try again.");
        setMembershipsLoading(false);
      },
    );return()=>{alive=false;stop()};
  }, [uid, tenantId,retryTick]);

  const currentId = current?.status === "active" ? current.id : null;
  const washBinding = current?.status === "active" ? current.washServiceIds : undefined;
  const washBindingKey = washBinding?.join("|") ?? "";
  const washesUsedNow = current?.washesUsed ?? 0;
  useEffect(() => {
    if (!currentId) { setRedeemed(null); return; }
    let alive = true;
    void getMembershipUsage(currentId).then((u) => { if (alive) setRedeemed(reconcileRedeemed(valueRedeemed(u), washesUsedNow)); }).catch(() => { if (alive) setRedeemed(null); });
    return () => { alive = false; };
  }, [currentId, washesUsedNow]);
  // The "book with my membership" button exists only once the server records included washes (see lib/membership-wash.ts).
  useEffect(() => {
    setWashIds([]);if (!MEMBERSHIP_WASH_LIVE || !currentId) return;let alive=true;
    // Snapshot parity with the server: a membership carrying washServiceIds covers only those
    // services; without it the legacy global flag decides. Never offer a wash the server would refuse.
    void getServiceCatalogue().then((all) => {if(alive)setWashIds(all.filter((x) => washBinding !== undefined ? washBinding.includes(x.id) : x.membershipWashEligible === true).map((x) => x.id))}).catch(() => undefined);return()=>{alive=false};
  }, [currentId, washBindingKey]);

  const loading = plansLoading || membershipsLoading;
  if (loading) return <Loading label="Opening membership" />;
  if (error) {
    return (
      <Screen onBack={originBack}>
        <Notice
          title="Could not load membership"
          body={error}
          action={<Button kind="quiet" icon="refresh" label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>}
        />
      </Screen>
    );
  }

  const cols = compareCols(plans, current?.planId ?? null);
  const today = todayInIndia();
  const active = current?.status === "active";
  const rupeesOf = (paise: number) => rupees(paise);

  return (
    <Screen onBack={originBack}
      header={
        <PageHeader kicker="Membership" title={current ? "Your membership" : "Choose your wash plan"} sub={current ? null : "Pick a plan and pay online."} />
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
          <View style={{ flexDirection:'row',alignItems:'stretch',gap:10 }}>
            {active && MEMBERSHIP_WASH_LIVE && washIds.length > 0 ? (
              hubAction('Book a wash with my plan',() => router.push(washIds.length === 1 ? `/(tabs)/catalogue/${washIds[0]}` : '/(tabs)/catalogue'),true)
            ) : null}
            {current.status === "pending" && current.planId ? hubAction('Pay online',() => router.push({ pathname: '/(tabs)/membership/purchase', params: { planId: current.planId! } }),true) : null}
            {hubAction('Usage and history',() => router.push('/(tabs)/membership/usage'))}
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
        <Notice title="No plans available" body="No membership plans are available right now." />
      ) : (
        <View style={{ gap: space.line }}>
          <Kicker>{current ? "Plans" : "Compare plans"}</Kicker>
          <PlanCompare cols={cols} onOpen={(id) => router.push({ pathname: "/(tabs)/membership/purchase", params: { planId: id } })} />
        </View>
      )}
    </Screen>
  );
}
