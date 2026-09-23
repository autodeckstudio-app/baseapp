import { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import type { MembershipUsage } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Kicker, Loading, Notice, Pane, Row, Screen, rupees } from "../../../ui/kit";
import { getMyMemberships, getMembershipUsage } from "../../../lib/membership-service";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MembershipUsageScreen() {
  const [usage, setUsage] = useState<MembershipUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const memberships = await getMyMemberships();
      const current = memberships.find((m) => m.status === "active" || m.status === "pending");
      if (!current) {
        setUsage([]);
        return;
      }
      setUsage(await getMembershipUsage(current.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load usage.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Opening usage" />;
  if (error) return <Screen><Notice title="Could not load usage" body={error} /></Screen>;

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Membership usage</Kicker>
        </View>
      }
    >
      {usage.length === 0 ? (
        <Notice title="No usage yet" body="Book a wash or service to see it here." />
      ) : (
        <Pane pad="gap">
          {usage.map((u, i) => (
            <Row
              key={u.id}
              title={u.usageType === "wash" ? "Wash credit used" : "Discount applied"}
              detail={formatDate(u.usedAt)}
              trailing={rupees(u.valueRedeemed)}
              last={i === usage.length - 1}
            />
          ))}
        </Pane>
      )}
    </Screen>
  );
}
