import { View } from "react-native";
import { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import type { Membership } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { HeroImage, Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T } from "../../../ui/kit";
import { listenToMyMemberships } from "../../../lib/home-service";
import { useAuth } from "../../../hooks/useAuth";
import { sceneImagery } from "../../../lib/imagery";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function CurrentMembershipScreen() {
  const router = useRouter();
  const auth = useAuth();
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uid = auth.status === "ready" ? auth.user.uid : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  // Live status: studio confirmation, online payment activation, cancellation
  // and expiry appear without a reload.
  useEffect(() => {
    if (!uid || !tenantId) return;
    setLoading(true);
    setError(null);
    return listenToMyMemberships(
      tenantId,
      uid,
      (memberships) => {
        setMembership(memberships.find((m) => m.status === "active" || m.status === "pending") ?? null);
        setLoading(false);
      },
      (e) => {
        setError(e.message);
        setLoading(false);
      },
    );
  }, [uid, tenantId]);

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

  const isPending = membership.status === "pending";
  const washesRemaining = Math.max(0, membership.washesTotal - membership.washesUsed);
  // Display-only deadline estimate matching the default pending-expiry window.
  const pendingDeadline = new Date(Date.parse(membership.createdAt) + 48 * 3600000);

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
      {isPending ? (
        <Notice
          title="Payment pending - benefits locked"
          body={`Pay at the studio or complete your online payment to activate. Washes and your discount unlock as soon as payment is confirmed. If payment is not confirmed by ${formatDate(pendingDeadline.toISOString())}, this request is cancelled automatically.`}
        />
      ) : null}

      <View style={isPending ? { opacity: 0.45 } : undefined}>
        <Pane pad="none" round="hero" fill="cool" tone="premium">
          <HeroImage source={sceneImagery.membership} />
          <View style={{ padding: space.inset, gap: space.breath }}>
            <T role="display">{isPending ? membership.washesTotal : washesRemaining}</T>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: "#EC8638", width: `${!isPending && membership.washesTotal > 0 ? Math.round((washesRemaining / membership.washesTotal) * 100) : 0}%` }} />
            </View>
            <T tone="secondary">
              {isPending
                ? `${membership.washesTotal} washes a month and ${membership.discountPercent}% off other services - available after activation`
                : `of ${membership.washesTotal} washes left this cycle Â· ${membership.discountPercent}% off everything else`}
            </T>
          </View>
        </Pane>

        <Pane pad="gap">
          <Row title={isPending ? "Washes (locked)" : "Washes remaining"} detail={`${isPending ? membership.washesTotal : washesRemaining} / ${membership.washesTotal}`} />
          <Row title={isPending ? "Discount (locked)" : "Discount on other services"} detail={`${membership.discountPercent}%`} />
          {isPending ? <Row title="Status" detail="Available after activation" /> : null}
          {membership.startDate ? <Row title="Started" detail={formatDate(membership.startDate)} /> : null}
          {membership.endDate ? <Row title="Renews / expires" detail={formatDate(membership.endDate)} last /> : <Row title="" detail="" last />}
        </Pane>
      </View>

      <View style={{ gap: space.breath }}>
        <Button label="View usage" kind="quiet" onPress={() => router.push("/(tabs)/membership/usage")} />
        <Button label="Membership history" kind="quiet" onPress={() => router.push("/(tabs)/membership/history")} />
      </View>
    </Screen>
  );
}
