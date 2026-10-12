import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { floatCard } from "@autodeck/ui/theme";
import { CanvasTitle } from "../../components/CanvasTitle";
import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, typography, Button, ErrorState, LoadingState } from "@autodeck/ui";

type Bk = { plate: string; car: string; when: string; status: string };
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
  const [bookings, setBookings] = useState<Record<string, Bk | null>>({});
  const [hidden, setHidden] = useState(0);
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
    // Every request must belong to a real booking. Look each one up; requests with no booking behind them are not shown.
    const found: Record<string, Bk | null> = {};
    await Promise.all(list.map(async (r) => {
      try {
        const b = await getDoc(doc(db, COLLECTIONS.bookings(), r.bookingId));
        if (!b.exists()) { found[r.id] = null; return; }
        const d = b.data() as { vehicleSnapshot?: { registrationNumber?: string; make?: string; model?: string }; scheduledAt?: string; status?: string };
        const v = d.vehicleSnapshot;
        found[r.id] = { plate: v?.registrationNumber ?? "", car: [v?.make, v?.model].filter(Boolean).join(" "), when: d.scheduledAt ? formatAgreed(d.scheduledAt) : "", status: d.status ?? "" };
      } catch { found[r.id] = null; }
    }));
    setBookings(found);
    const real = list.filter((r) => { const b = found[r.id]; return b && !["CANCELLED", "COMPLETED", "NO_SHOW"].includes(b.status); });
    setHidden(list.length - real.length);
    setRows(real);
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
  const input = { ...typography.caption, color: colors.textPrimary, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.sm, height: 38, flex: 1, minWidth: 150 } as const;
  const wide = NightPlatform.OS === "web";
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: "transparent" }}
      ListHeaderComponent={<CanvasTitle eyebrow="Pickup and drop" title="Requests" />}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, width: "100%", maxWidth: 1040, alignSelf: "center", gap: spacing.sm }}
      data={rows}
      keyExtractor={(r) => r.id}
      ListFooterComponent={hidden > 0 ? <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.md }}>{hidden} request{hidden === 1 ? "" : "s"} hidden because {hidden === 1 ? "its booking was" : "their bookings were"} cancelled or completed.</Text> : null}
      ListEmptyComponent={<View style={{ backgroundColor: colors.surface, ...(wide ? floatCard(nightMaterial) : {}), borderRadius: 20, padding: spacing.xl, alignItems: "center" }}><Text style={{ ...typography.body, color: colors.textMuted }}>No pickup or drop requests right now.</Text></View>}
      renderItem={({ item: r }) => {
        const asked = r.kind !== "drop" ? (r.requestedPickupTime || r.preferredTime) : r.requestedDropTime;
        const agreed = [r.agreedPickupAt ? `Pickup ${formatAgreed(r.agreedPickupAt)}` : "", r.agreedDropAt ? `Drop ${formatAgreed(r.agreedDropAt)}` : ""].filter(Boolean).join("  ·  ");
        const confirmed = r.status === "CONFIRMED";
        return (
          <View style={{ backgroundColor: colors.surface, ...(wide ? floatCard(nightMaterial) : {}), borderRadius: 20, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.textPrimary }}>{KIND[r.kind] ?? r.kind}</Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: confirmed ? "rgba(120,200,140,.2)" : "rgba(236,134,56,.2)" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: confirmed ? "#8fd6a0" : colors.accent }}>{confirmed ? "Confirmed" : "New"}</Text>
              </View>
              {asked ? <Text style={{ ...typography.caption, color: colors.textMuted, marginLeft: "auto" }}>Asked for {asked}</Text> : null}
            </View>
            {bookings[r.id] ? <Text numberOfLines={1} style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600" }}>{[bookings[r.id]?.plate, bookings[r.id]?.car].filter(Boolean).join(" · ")}{bookings[r.id]?.when ? `  ·  Booking ${bookings[r.id]?.when}` : ""}</Text> : null}
            <Text numberOfLines={2} style={{ ...typography.caption, color: colors.textPrimary, opacity: 0.85 }}>{r.address}</Text>
            {confirmed && agreed ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{agreed}</Text> : null}
            {r.status === "REQUESTED" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {r.kind !== "drop" ? <TextInput value={agreedPickup[r.id] ?? ""} onChangeText={(v) => setAgreedPickup((s) => ({ ...s, [r.id]: v }))} placeholder="Pickup time, 2026-10-12 16:30" placeholderTextColor={colors.textMuted} style={input} /> : null}
                {r.kind !== "pickup" ? <TextInput value={agreedDrop[r.id] ?? ""} onChangeText={(v) => setAgreedDrop((s) => ({ ...s, [r.id]: v }))} placeholder="Drop time, 2026-10-13 18:00" placeholderTextColor={colors.textMuted} style={input} /> : null}
              </View>
            ) : null}
            {error && rows !== null ? <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text> : null}
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {r.status === "REQUESTED" ? <Button label="Confirm" size="md" fullWidth={false} disabled={busy !== null} loading={busy === r.id} onPress={() => void setStatus(r, "CONFIRMED")} /> : null}
              {confirmed ? <Button label="Mark done" size="md" fullWidth={false} disabled={busy !== null} loading={busy === r.id} onPress={() => void setStatus(r, "DONE")} /> : null}
              <Button label="Decline" size="md" variant="secondary" fullWidth={false} disabled={busy !== null} loading={busy === r.id} onPress={() => void setStatus(r, "DECLINED")} />
            </View>
          </View>
        );
      }}
    />
  );
}
