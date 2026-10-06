import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Alert } from "react-native";
import { collection, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, radius, typography, Button, ErrorState, LoadingState } from "@autodeck/ui";

type Req = { id: string; bookingId: string; kind: string; address: string; preferredTime: string; note: string; status: string; staffNote: string };
const KIND: Record<string, string> = { pickup: "Pick up", drop: "Drop back", both: "Pick up and drop back" };

export default function PickupsScreen() {
  const auth = useAuth();
  const [rows, setRows] = useState<Req[] | null>(null);
  const [error,setError] = useState<string|null>(null);
  const [busy, setBusy] = useState<string | null>(null);
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
    setBusy(r.id);
    try {
      await httpsCallable(functions, "updatePickupRequest")({ requestId: r.id, status });
      await load();
    } catch (e) {
      Alert.alert("Could not update", e instanceof Error ? e.message : "Try again.");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <ErrorState title="Requests unavailable" message={error} onRetry={()=>void load().catch(e=>setError(e instanceof Error?e.message:"Try again."))}/>;
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
          {r.preferredTime ? <Text style={{ ...typography.caption, color: colors.textMuted }}>Preferred: {r.preferredTime}</Text> : null}
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{r.status === "CONFIRMED" ? "Confirmed" : "New request"}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
            {r.status === "REQUESTED" ? <Button label="Confirm" size="md" fullWidth={false} loading={busy === r.id} onPress={() => void setStatus(r, "CONFIRMED")} /> : null}
            {r.status === "CONFIRMED" ? <Button label="Mark done" size="md" fullWidth={false} loading={busy === r.id} onPress={() => void setStatus(r, "DONE")} /> : null}
            <Button label="Decline" size="md" variant="secondary" fullWidth={false} loading={busy === r.id} onPress={() => void setStatus(r, "DECLINED")} />
          </View>
        </View>
      )}
    />
  );
}
