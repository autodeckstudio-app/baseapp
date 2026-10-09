import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Button, ErrorState, LoadingState } from "@autodeck/ui";

type Req = { id: string; bookingId: string; kind: string; address: string; preferredTime: string; requestedPickupTime?: string; requestedDropTime?: string; agreedPickupAt?: string | null; agreedDropAt?: string | null; note: string; status: string; staffNote: string };
const KIND: Record<string, string> = { pickup: "Pick up", drop: "Drop back", both: "Pick up and drop back" };

function formatAgreed(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

export default function PickupsScreen() {
  const auth = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [error,setError] = useState<string|null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [agreedPickup, setAgreedPickup] = useState<Record<string, string>>({});
  const [agreedDrop, setAgreedDrop] = useState<Record<string, string>>({});
  const studioId = auth.status === "ready" ? auth.claims.studioId : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  const load = useCallback(async () => {
    if (!tenantId || !studioId) return;
    setError(null);
    const snap = await getDocs(query(collection(db, COLLECTIONS.pickupRequests()), where("tenantId", "==", tenantId), where("studioId", "==", studioId)));
    const list = snap.docs.map((d) => d.data() as Req).filter((r) => r.status === "REQUESTED" || r.status === "CONFIRMED");
    setRows(list);
  }, [tenantId, studioId]);

  useEffect(() => { void load().catch((e) => { setError(e instanceof Error ? e.message : "Try again."); }); }, [load]);

  async function setStatus(r: Req, status: "CONFIRMED" | "DONE" | "DECLINED") {
    if(busy) return;
    setBusy(r.id);
    try {
      const payload: Record<string, string> = { requestId: r.id, status };
      if (status === "CONFIRMED") {
        // Timing is agreed with the customer by phone call; it must be entered here.
        if (r.kind !== "drop") {
          const v = (agreedPickup[r.id] ?? "").trim();
          if (!v) { setError("Enter the pickup time agreed with the customer on the call (YYYY-MM-DD HH:mm)."); setBusy(null); return; }
          payload.agreedPickupAt = v;
        }
        if (r.kind !== "pickup") {
          const v = (agreedDrop[r.id] ?? "").trim();
          if (!v) { setError("Enter the dropoff time agreed with the customer on the call (YYYY-MM-DD HH:mm)."); setBusy(null); return; }
          payload.agreedDropAt = v;
        }
      }
      await httpsCallable(functions, "updatePickupRequest")(payload);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update request. Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (error && rows === null) return <ErrorState title="Requests unavailable" message={error} onRetry={()=>void load().catch(e=>setError(e instanceof Error?e.message:"Try again."))}/>;
  if (rows === null) return <LoadingState />;
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, width: "100%", maxWidth: 640, alignSelf: "center", gap: spacing.sm }}
      data={rows}
      keyExtractor={(r) => r.id}
      ListEmptyComponent={<Text style={{ ...typography.body, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl }}>No pickup or drop requests right now.</Text>}
      renderItem={({ item: r }) => (
        <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.xs }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>{KIND[r.kind] ?? r.kind}</Text>
          <Text style={{ ...typography.body, color: colors.textPrimary }}>{r.address}</Text>
          {r.kind !== "drop" && (r.requestedPickupTime || r.preferredTime) ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Customer asked: {r.requestedPickupTime || r.preferredTime}</Text> : null}
          {r.kind !== "pickup" && r.requestedDropTime ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Customer asked (dropoff): {r.requestedDropTime}</Text> : null}
          {r.status === "CONFIRMED" && r.agreedPickupAt ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Pickup agreed: {formatAgreed(r.agreedPickupAt)}</Text> : null}
          {r.status === "CONFIRMED" && r.agreedDropAt ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Dropoff agreed: {formatAgreed(r.agreedDropAt)}</Text> : null}
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{r.status === "CONFIRMED" ? "Confirmed" : "New request"}</Text>
          {r.status === "REQUESTED" ? (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              <Text style={{ ...typography.caption, color: colors.textMuted }}>Agree the time with the customer by phone call, then enter it here (YYYY-MM-DD HH:mm).</Text>
              {r.kind !== "drop" ? (
                <TextInput
                  value={agreedPickup[r.id] ?? ""}
                  onChangeText={(v) => setAgreedPickup((s) => ({ ...s, [r.id]: v }))}
                  placeholder="Agreed pickup time, e.g. 2026-10-12 16:30"
                  placeholderTextColor={colors.textMuted}
                  style={{ ...typography.body, color: colors.textPrimary, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
                />
              ) : null}
              {r.kind !== "pickup" ? (
                <TextInput
                  value={agreedDrop[r.id] ?? ""}
                  onChangeText={(v) => setAgreedDrop((s) => ({ ...s, [r.id]: v }))}
                  placeholder="Agreed dropoff time, e.g. 2026-10-13 18:00"
                  placeholderTextColor={colors.textMuted}
                  style={{ ...typography.body, color: colors.textPrimary, backgroundColor: colors.background, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}
                />
              ) : null}
            </View>
          ) : null}
          {error && rows !== null ? <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text> : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
            {r.status === "REQUESTED" ? <Button label="Confirm" size="md" fullWidth={false} disabled={busy!==null} loading={busy === r.id} onPress={() => void setStatus(r, "CONFIRMED")} /> : null}
            {r.status === "CONFIRMED" ? <Button label="Mark done" size="md" fullWidth={false} disabled={busy!==null} loading={busy === r.id} onPress={() => void setStatus(r, "DONE")} /> : null}
            <Button label="Decline" size="md" variant="secondary" fullWidth={false} disabled={busy!==null} loading={busy === r.id} onPress={() => void setStatus(r, "DECLINED")} />
          </View>
        </View>
      )}
    />
  );
}
