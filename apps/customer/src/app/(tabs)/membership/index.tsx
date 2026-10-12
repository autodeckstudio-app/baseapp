import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, HeroImage, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { getMembershipPlans } from "../../../lib/membership-service";
import { listenToMyMemberships } from "../../../lib/home-service";
import { useAuth } from "../../../hooks/useAuth";
import { sceneImagery } from "../../../lib/imagery";

export default function MembershipScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        setMembershipsLoading(false);
      },
      (e) => {
        setError(e.message);
        setMembershipsLoading(false);
      },
    );
  }, [uid, tenantId]);

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

  const otherPlans = plans;

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Membership</Kicker>
          <T role="title">Care, made regular</T>
        </View>
      }
    >
      <Pane pad="none" round="hero" fill="cool" tone="premium">
        <HeroImage source={sceneImagery.membership} />
        <View style={{ padding: space.inset, gap: space.breath }}>
          <T role="heading">The {current ? "club" : "AutoDeck club"}</T>
          <T tone="secondary">Regular washes, a standing discount, and a car that always looks done.</T>
        </View>
      </Pane>

      {current ? (
        <Pane pad="gap" fill="cool" tone="premium">
          <Row
            title={current.tier}
            detail={current.status === "pending" ? "Payment pending - benefits locked" : "Your membership"}
            trailing={<Chip label={current.status} tone={current.status === "active" ? "premium" : "neutral"} />}
            onPress={() => router.push("/(tabs)/membership/current")}
            last
          />
        </Pane>
      ) : null}

      <View style={{ gap: space.line }}>
        <Kicker>{current ? "Other plans" : "Choose a plan"}</Kicker>
        {otherPlans.length === 0 ? (
          <Notice title="No plans available" body="Check back soon." />
        ) : (
          otherPlans.map((p) => {
            const topTier = p.priceInPaise === Math.max(...otherPlans.map((x) => x.priceInPaise));
            return (
              <Pressable key={p.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/membership/${p.id}`)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
                <Pane pad="inset" {...(topTier ? { tone: "premium" as const, fill: "cool" as const } : {})}>
                  <View style={{ gap: space.line }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.line }}>
                      <View style={{ flex: 1, gap: space.hair }}>
                        {topTier ? <Chip label="More included" tone="premium" /> : null}
                        <T role="heading">{p.name}</T>
                      </View>
                      <View style={{ borderRadius: 9999, backgroundColor: "#EC8638", paddingHorizontal: 14, paddingVertical: 8 }}>
                        <T role="bodyStrong" style={{ color: "#1A1410" }}>{rupees(p.priceInPaise)}</T>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      <Chip label={`${p.includedWashes} washes a month`} tone="accent" />
                      <Chip label={`${p.discountPercent}% off other services`} />
                    </View>
                  </View>
                </Pane>
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}
