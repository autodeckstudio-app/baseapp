import { useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import type { Membership } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Chip, Kicker, Loading, Notice, Pane, Row, Screen } from "../../../ui/kit";
import { getMyMemberships } from "../../../lib/membership-service";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MembershipHistoryScreen() {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMemberships(await getMyMemberships());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load membership history.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Opening history" />;
  if (error) return <Screen><Notice title="Could not load history" body={error} /></Screen>;

  return (
    <Screen
      header={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Membership</Kicker>
        </View>
      }
    >
      {memberships.length === 0 ? (
        <Notice title="No memberships yet" body="Plans you join will appear here." />
      ) : (
        <Pane pad="gap">
          {memberships.map((m, i) => (
            <Row
              key={m.id}
              title={m.tier}
              detail={`${m.startDate ? formatDate(m.startDate) : "Not started"}${m.endDate ? ` - ${formatDate(m.endDate)}` : ""}`}
              trailing={<Chip label={m.status} tone={m.status === "active" ? "premium" : "neutral"} />}
              last={i === memberships.length - 1}
            />
          ))}
        </Pane>
      )}
    </Screen>
  );
}
