import { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { Membership, MembershipPlan } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { getMembershipPlans, getMyMemberships } from "../../../lib/membership-service";

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
      {current ? (
        <Pane pad="gap">
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
          <Pane pad="gap">
            {otherPlans.map((p, i) => (
              <Row
                key={p.id}
                title={p.name}
                detail={`${p.includedWashes} washes · ${p.discountPercent}% off other services`}
                trailing={<T role="label" tone="accent">{rupees(p.priceInPaise)}</T>}
                onPress={() => router.push(`/(tabs)/membership/${p.id}`)}
                last={i === otherPlans.length - 1}
              />
            ))}
          </Pane>
        )}
      </View>
    </Screen>
  );
}
