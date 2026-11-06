import { useState, useEffect } from "react";
import { View } from "react-native";
import type { Membership } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Chip, Button, Kicker, PageHeader, Loading, Notice, Pane, Row, Screen } from "../../../ui/kit";
import { listenToMyMemberships } from "../../../lib/home-service";
import { useAuth } from "../../../hooks/useAuth";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function MembershipHistoryScreen() {
  const auth = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const uid = auth.status === "ready" ? auth.customerDocId : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  useEffect(() => {
    setMemberships([]);setError(null);if (!uid || !tenantId) {setLoading(false);setError("Sign in to see your membership history.");return;}let alive=true;
    setLoading(true);
    setError(null);
    const stop=listenToMyMemberships(
      tenantId,
      uid,
      (rows) => {
        if(!alive)return;setMemberships([...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setLoading(false);
      },
      (e) => {
        if(!alive)return;setError("Your membership history could not load. Try again.");
        setLoading(false);
      },
    );return()=>{alive=false;stop()};
  }, [uid, tenantId]);

  if (loading) return <Loading label="Opening history" />;
  if (error) return <Screen><Notice title="Could not load history" body={error} /></Screen>;

  return (
    <Screen
      header={
        <PageHeader kicker="Membership" title="Your plans over time" sub={`${memberships.length} ${memberships.length === 1 ? "record" : "records"}`} />
      }
    >
      {memberships.length === 0 ? (
        <Notice title="No memberships yet" body="Plans you join will appear here." />
      ) : (
        <Pane pad="gap">
          {memberships.map((m, i) => (
            <Row
              key={m.id}
              title={m.tier.charAt(0).toUpperCase()+m.tier.slice(1)}
              detail={
                m.status === "cancelled"
                  ? `Cancelled${m.cancellationReason === "pending_payment_expired" ? " - payment not completed in time" : ""} - requested ${formatDate(m.createdAt)}`
                  : `${m.startDate ? formatDate(m.startDate) : "Not started"}${m.endDate ? ` - ${formatDate(m.endDate)}` : ""}`
              }
              trailing={<Chip label={m.status} tone={m.status === "active" ? "premium" : "neutral"} />}
              last={i === memberships.length - 1}
            />
          ))}
        </Pane>
      )}
    </Screen>
  );
}
