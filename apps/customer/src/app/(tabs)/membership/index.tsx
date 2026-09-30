import { useState, useEffect, useCallback } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { HeroImage, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { getMembershipPlans, getMyMemberships } from "../../../lib/membership-service";
import { sceneImagery } from "../../../lib/imagery";

export default function MembershipScreen() {
  const router = useRouter();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [current, setCurrent] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [plansData, memberships] = await Promise.all([getMembershipPlans(), getMyMemberships()]);
      setPlans(plansData);
      setCurrent(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership plans.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Opening membership" />;
  if (error) {
    return (
      <Screen>
        <Notice
          title="Could not load membership"
          body={error}
          action={<Chip label="Try again" tone="accent" />}
        />
      </Screen>
    );
  }

  const otherPlans = current ? plans : plans;

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Membership</Kicker>
          <T role="title">Plans that pay for themselves</T>
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
            detail="Your membership"
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
                <Pane pad="gap" {...(topTier ? { tone: "premium" as const, fill: "cool" as const } : {})}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.line }}>
                    <View style={{ flex: 1, gap: space.hair }}>
                      <T role="heading">{p.name}</T>
                      <T role="caption" tone="tertiary">{p.includedWashes} washes a month · {p.discountPercent}% off other services</T>
                    </View>
                    <T role="bodyStrong" tone="accent">{rupees(p.priceInPaise)}</T>
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
