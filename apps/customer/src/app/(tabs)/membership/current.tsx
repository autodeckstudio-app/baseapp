import { View } from "react-native";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "expo-router";
import type { Membership } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T } from "../../../ui/kit";
import { getMyMemberships } from "../../../lib/membership-service";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CurrentMembershipScreen() {
  const router = useRouter();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memberships = await getMyMemberships();
      setMembership(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Opening your membership" />;
  if (error) return <Screen><Notice title="Could not load membership" body={error} /></Screen>;
  if (!membership) {
    return (
      <Screen>
        <Notice
          title="No active membership"
          body="Join a plan to start saving on your services."
          action={<Button label="Browse plans" onPress={() => router.push("/(tabs)/membership")} />}
        />
      </Screen>
    );
  }

  const washesRemaining = Math.max(0, membership.washesTotal - membership.washesUsed);

  return (
    <Screen
      header={
        <View style={{ gap: space.breath }}>
          <Kicker tone="accent">Your membership</Kicker>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.inset }}>
            <T role="title" style={{ textTransform: "capitalize" }}>{membership.tier}</T>
            <Chip label={membership.status} tone={membership.status === "active" ? "premium" : "neutral"} />
          </View>
        </View>
      }
    >
      {membership.status === "pending" ? (
        <Notice title="Almost there" body="Awaiting payment confirmation from the studio." />
      ) : null}

      <Pane pad="gap">
        <Row title="Washes remaining" detail={`${washesRemaining} / ${membership.washesTotal}`} />
        <Row title="Discount on other services" detail={`${membership.discountPercent}%`} />
        {membership.startDate ? <Row title="Started" detail={formatDate(membership.startDate)} /> : null}
        {membership.endDate ? <Row title="Renews / expires" detail={formatDate(membership.endDate)} last /> : <Row title="" detail="" last />}
      </Pane>

      <View style={{ gap: space.breath }}>
        <Button label="View usage" kind="quiet" onPress={() => router.push("/(tabs)/membership/usage")} />
        <Button label="Membership history" kind="quiet" onPress={() => router.push("/(tabs)/membership/history")} />
      </View>
    </Screen>
  );
}
