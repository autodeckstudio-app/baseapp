import{RetainedTransportActions}from"../../components/RetainedTransportActions";
import{RETAINED_TRANSPORT_PREVIEW,useRetainedTransportPreview}from'../../lib/use-retained-transport-preview';
import{retainedTransportLabel}from'@autodeck/core';
import { pickupEligibility } from "@autodeck/core";
import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { floatCard } from "@autodeck/ui/theme";
import { CanvasTitle } from "../../components/CanvasTitle";
import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, TextInput, FlatList } from "react-native";
import { collection, doc, getDoc, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { COLLECTIONS } from "@autodeck/database";
import { db, functions } from "../../lib/firebase";
import { useAuth } from "../../hooks/useAuth";
import { colors, spacing, typography, Button, ErrorState, LoadingState } from "@autodeck/ui";
import { AgreedTimeInput } from "../../components/AgreedTimeInput";
import {PickupHandoverForm, type PickupHandoverSummary} from "../../components/PickupHandoverForm";
import {PICKUP_HANDOVER_ENABLED} from "../../lib/backend-features";
import { PICKUP_LEG_PROGRESS_ENABLED } from "../../lib/backend-features";
import { legsFor, canMarkLeg, legPayload, outstandingNote, type LegName } from "../../lib/pickup-legs";
import { pickupFeeLabel, confirmBlockReason, checkAgreedTime } from "../../lib/pickup-form";

type Bk = { plate: string; car: string; when: string; status: string };
type Req = { pickupHandover?:PickupHandoverSummary|null;dropHandover?:PickupHandoverSummary|null;handoverUnavailable?:boolean; pickupCompletedAt?: string | null; dropCompletedAt?: string | null; feePaise?: number | null; memberMembershipId?: string | null; id: string; bookingId: string; kind: string; address: string; preferredTime: string; requestedPickupTime?: string; requestedDropTime?: string; agreedPickupAt?: string | null; agreedDropAt?: string | null; note: string; status: string; staffNote: string };
const KIND: Record<string, string> = { pickup: "Pick up", drop: "Drop back", both: "Pick up and drop back" };

function formatAgreed(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

export default function PickupsScreen() {
  const auth = useAuth();
  const [history,setHistory]=useState(false);
  const loadGeneration=useRef(0);
  const [rows, setRows] = useState<Req[] | null>(null);
  const [error,setError] = useState<string|null>(null);
  const [bookings, setBookings] = useState<Record<string, Bk | null>>({});
  const [hidden, setHidden] = useState(0);
  const [bookingIdsKey,setBookingIdsKey]=useState("[]");
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [errId, setErrId] = useState<string | null>(null);
  const [agreedPickup, setAgreedPickup] = useState<Record<string, string>>({});
  const [agreedDrop, setAgreedDrop] = useState<Record<string, string>>({});
  const studioId = auth.status === "ready" ? auth.claims.studioId : null;
  const principalId=auth.status === "ready" ? auth.user?.uid : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;

  const principalScope=[principalId,tenantId,studioId,history].join("|");
  const liveScope=useRef(principalScope);liveScope.current=principalScope;
  const [resolvedScope,setResolvedScope]=useState("");
  const load = useCallback(async () => {
    if (!tenantId || !studioId) return;
    const generation=++loadGeneration.current,scope=principalScope;
    setError(null);
    const snap = await getDocs(query(collection(db, COLLECTIONS.pickupRequests()), where("tenantId", "==", tenantId), where("studioId", "==", studioId)));
    const allRequests = snap.docs.map((d) => ({...d.data(),id:d.id ?? d.data().id}) as Req);
    if(generation!==loadGeneration.current||liveScope.current!==scope)return;
    setBookingIdsKey(JSON.stringify([...new Set(allRequests.map(r=>r.bookingId))].sort()));
    const list = RETAINED_TRANSPORT_PREVIEW?allRequests:allRequests.filter((r) => (history ? r.status === "DONE" || r.status === "DECLINED" : r.status === "REQUESTED" || r.status === "CONFIRMED"));
    // Every request must belong to a real booking. Look each one up; requests with no booking behind them are not shown.
    const found: Record<string, Bk | null> = {};
    await Promise.all(list.map(async (r) => {
      try {
        const b = await getDoc(doc(db, COLLECTIONS.bookings(), r.bookingId));
        if (!b.exists()) { if(RETAINED_TRANSPORT_PREVIEW)throw Error("Booking unavailable.");found[r.id] = null; return; }
        const d = b.data() as { vehicleSnapshot?: { registrationNumber?: string; make?: string; model?: string }; scheduledAt?: string; status?: string };
        const v = d.vehicleSnapshot;
        found[r.id] = { plate: v?.registrationNumber ?? "", car: [v?.make, v?.model].filter(Boolean).join(" "), when: d.scheduledAt ? formatAgreed(d.scheduledAt) : "", status: d.status ?? "" };
      } catch { throw new Error("Booking status unavailable. Requests could not be checked."); }
    }));
    if(generation!==loadGeneration.current||liveScope.current!==scope)return;
    setBookings(found);
    // Same eligibility matrix as Admin: a COMPLETED booking still shows while a return (drop) is owed or the request just needs closing.
    const real = RETAINED_TRANSPORT_PREVIEW?list:list.filter((r) => history ? !!found[r.id] : pickupEligibility(r, found[r.id]?.status ?? null).actionable);
    if(PICKUP_HANDOVER_ENABLED&&!RETAINED_TRANSPORT_PREVIEW)await Promise.all(real.map(async r=>{try{for(const leg of legsFor(r)){const {data}=await httpsCallable<{requestId:string;leg:LegName},{record:PickupHandoverSummary|null}>(functions,"getPickupHandover")({requestId:r.id,leg:leg.leg});if(leg.leg==="pickup")r.pickupHandover=data.record;else r.dropHandover=data.record;}}catch{r.handoverUnavailable=true;}}));
    if(generation!==loadGeneration.current||liveScope.current!==scope)return;
    setHidden(list.length - real.length);
    setRows(real);setResolvedScope(scope);
  }, [tenantId, studioId, history, principalId, principalScope]);

  useEffect(() => { setRows(null);setBookings({});setAgreedPickup({});setAgreedDrop({});void load().catch((e) => { setError(e instanceof Error ? e.message : "Try again."); }); return()=>{loadGeneration.current++};}, [load]);

  // Incoming requests and Admin/customer changes must refresh an already-open tab.
  useEffect(()=>{
    if(!tenantId||!studioId)return;
    let active=true;
    const fail=(e:unknown)=>{if(active){setRows(null);setError(e instanceof Error?e.message:"Requests unavailable. Try again.")}};
    const stop=onSnapshot(query(collection(db,COLLECTIONS.pickupRequests()),where("tenantId","==",tenantId),where("studioId","==",studioId)),()=>{if(active)void load().catch(fail)},fail);
    return()=>{active=false;stop()};
  },[tenantId,studioId,load]);
  // Booking eligibility can change without a pickup-request write.
  useEffect(()=>{
    if(!tenantId||!studioId)return;
    let active=true;
    const stops=(JSON.parse(bookingIdsKey) as string[]).map(id=>{
      let initial=true;
      return onSnapshot(doc(db,COLLECTIONS.bookings(),id),()=>{if(initial){initial=false;return}if(active)void load().catch(e=>{if(active){setRows(null);setError(e instanceof Error?e.message:"Booking status unavailable.")}})},e=>{if(active){setRows(null);setError(e.message)}});
    });
    return()=>{active=false;stops.forEach(stop=>stop())};
  },[bookingIdsKey,tenantId,studioId,load]);

  const verified=useRetainedTransportPreview(auth.status==='ready'?JSON.stringify([principalId,auth.claims.role,tenantId,studioId]):null,resolvedScope===principalScope?rows?.map(r=>r.id)??null:null);
  const physical=new Map(verified.status==='ready'?verified.data.batch.rows.filter(r=>r.kind==='retained').map(r=>[r.requestId,r.physical]):[]);
  const exactStatuses=new Map(verified.status==='ready'?verified.data.bookings.map(b=>[b.requestId,b.status]):[]);
  const shownRows=!RETAINED_TRANSPORT_PREVIEW?rows:(rows??[]).filter(r=>{const p=physical.get(r.id);return p?(p.placement==='history')===history:history?r.status==='DONE'||r.status==='DECLINED':(r.status==='REQUESTED'||r.status==='CONFIRMED')&&pickupEligibility(r,exactStatuses.get(r.id)??null).actionable;});

  async function markLeg(r: Req, leg: LegName) {
    if (physical.has(r.id) || RETAINED_TRANSPORT_PREVIEW&&verified.status!=="ready" || busyRef.current || !PICKUP_LEG_PROGRESS_ENABLED || !canMarkLeg(r, leg)) return;
    busyRef.current = true; setBusy(r.id); setErrId(r.id); setError(null);
    try { await httpsCallable(functions, "updatePickupRequest")(legPayload(r.id, leg)); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update request. Try again."); }
    finally { busyRef.current = false; setBusy(null); }
  }

  async function setStatus(r: Req, status: "CONFIRMED" | "DONE" | "DECLINED") {
    if(busy || physical.has(r.id) || RETAINED_TRANSPORT_PREVIEW&&verified.status!=="ready") return;
    setBusy(r.id);
    setErrId(r.id);
    try {
      const payload: Record<string, string> = { requestId: r.id, status };
      if (status === "CONFIRMED") {
        // Timing is agreed with the customer by phone call; it must be entered here.
        if (r.kind !== "drop") {
          const c = checkAgreedTime(agreedPickup[r.id] ?? "");
          if (!c.ok) { setError(`Pickup time: ${c.error}`); setBusy(null); return; }
          payload.agreedPickupAt = c.value;
        }
        if (r.kind !== "pickup") {
          const c = checkAgreedTime(agreedDrop[r.id] ?? "");
          if (!c.ok) { setError(`Drop time: ${c.error}`); setBusy(null); return; }
          payload.agreedDropAt = c.value;
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

  if (RETAINED_TRANSPORT_PREVIEW && verified.status==="unavailable")return <ErrorState title="Requests unavailable" message="Try again." onRetry={()=>void load().catch(e=>setError(e instanceof Error?e.message:"Try again."))}/>;
  if (error && rows === null) return <ErrorState title="Requests unavailable" message={error} onRetry={()=>void load().catch(e=>setError(e instanceof Error?e.message:"Try again."))}/>;
  if (rows === null || resolvedScope!==principalScope || RETAINED_TRANSPORT_PREVIEW&&verified.status!=="ready") return <LoadingState />;
  const input = { ...typography.caption, color: colors.textPrimary, backgroundColor: colors.surfaceSunken, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.sm, height: 38, flex: 1, minWidth: 150 } as const;
  const wide = NightPlatform.OS === "web";
  return (
    <FlatList
      style={{ flex: 1, backgroundColor: "transparent" }}
      ListHeaderComponent={<View><CanvasTitle eyebrow="Pickup and drop" title={history?RETAINED_TRANSPORT_PREVIEW?"History":"Completed requests":"Requests"}/>{PICKUP_HANDOVER_ENABLED||RETAINED_TRANSPORT_PREVIEW?<Button label={history?"Open requests":RETAINED_TRANSPORT_PREVIEW?"History":"Completed history"} variant="secondary" size="md" onPress={()=>setHistory(v=>!v)}/>:null}</View>}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, width: "100%", maxWidth: 1040, alignSelf: "center", gap: spacing.sm }}
      data={shownRows}
      keyExtractor={(r) => r.id}
      ListFooterComponent={!RETAINED_TRANSPORT_PREVIEW&&hidden > 0 ? <Text style={{ ...typography.caption, color: colors.textMuted, textAlign: "center", marginTop: spacing.md }}>{hidden} request{hidden === 1 ? "" : "s"} hidden (booking cancelled, expired, missing, or nothing left to do).</Text> : null}
      ListEmptyComponent={<View style={{ backgroundColor: colors.surface, ...(wide ? floatCard(nightMaterial) : {}), borderRadius: 28, padding: spacing.xl, alignItems: "center" }}><Text style={{ ...typography.body, color: colors.textMuted }}>No pickup or drop requests right now.</Text></View>}
      renderItem={({ item: r }) => {
        const retained=physical.get(r.id);
        const asked = r.kind !== "drop" ? (r.requestedPickupTime || r.preferredTime) : r.requestedDropTime;
        const agreed = [!retained?.unusedLegs.includes("pickup")&&r.agreedPickupAt ? `Pickup ${formatAgreed(r.agreedPickupAt)}` : "", !retained?.unusedLegs.includes("drop")&&r.agreedDropAt ? `Drop ${formatAgreed(r.agreedDropAt)}` : ""].filter(Boolean).join("  ·  ");
        const confirmed = r.status === "CONFIRMED";
        const block = confirmBlockReason(r);
        return (
          <View style={{ backgroundColor: colors.surface, ...(wide ? floatCard(nightMaterial) : {}), borderRadius: 28, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              <Text style={{ ...typography.body, fontWeight: "700", color: colors.textPrimary }}>{KIND[r.kind] ?? r.kind}</Text>
              <View style={{ paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: retained?.placement==='active' ? "rgba(236,134,56,.2)" : confirmed ? "rgba(120,200,140,.2)" : "rgba(236,134,56,.2)" }}>
                <Text style={{ fontSize: 12, fontWeight: "600", color: retained ? colors.textPrimary : confirmed ? "#8fd6a0" : colors.accent }}>{retained?retainedTransportLabel(retained):history ? r.status === "DONE" ? "Done" : "Declined" : confirmed ? "Confirmed" : "New"}</Text>
              </View>
              {asked ? <Text style={{ ...typography.caption, color: colors.textMuted, marginLeft: "auto" }}>Asked for {asked}</Text> : null}
            </View>
            {bookings[r.id] ? <Text numberOfLines={1} style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600" }}>{[bookings[r.id]?.plate, bookings[r.id]?.car].filter(Boolean).join(" · ")}{bookings[r.id]?.when ? `  ·  Booking ${bookings[r.id]?.when}` : ""}</Text> : null}
            <Text numberOfLines={2} style={{ ...typography.caption, color: colors.textPrimary, opacity: 0.85 }}>{r.address}</Text>
            <Text accessibilityLabel="Pickup fee" style={{ ...typography.caption, color: r.feePaise === null || r.feePaise === undefined ? colors.accent : colors.textMuted, fontWeight: "600" }}>{`${retained?"Original quote":"Fee"}: ${pickupFeeLabel(r.feePaise, r.memberMembershipId, r.kind)}`}</Text>
            {block && !retained ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{block}</Text> : null}
            {confirmed && agreed ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{agreed}</Text> : null}
            {!retained && r.status === "REQUESTED" ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                {r.kind !== "drop" ? <AgreedTimeInput label="Pickup time agreed on the call" value={agreedPickup[r.id] ?? ""} onChange={(v) => setAgreedPickup((s) => ({ ...s, [r.id]: v }))} /> : null}
                {r.kind !== "pickup" ? <AgreedTimeInput label="Drop time agreed on the call" value={agreedDrop[r.id] ?? ""} onChange={(v) => setAgreedDrop((s) => ({ ...s, [r.id]: v }))} /> : null}
              </View>
            ) : null}
            {PICKUP_LEG_PROGRESS_ENABLED && confirmed ? (
              <View style={{ gap: spacing.xs }}>
                {legsFor(r).filter(l=>!retained||!retained.unusedLegs.includes(l.leg)).map((l) => (
                  <View key={l.leg} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
                    <Text style={{ ...typography.caption, color: colors.textPrimary, fontWeight: "600" }}>{l.doneAt ? `${l.label} done ${formatAgreed(l.doneAt)}` : `${l.label} not done yet`}</Text>
                    {!retained&&!l.doneAt ? <Button label={l.leg === "pickup" ? "Picked up" : "Dropped back"} size="md" variant="secondary" fullWidth={false} disabled={busy !== null} onPress={() => void markLeg(r, l.leg)} /> : null}
                  </View>
                ))}
                {!retained&&outstandingNote(r) ? <Text style={{ ...typography.caption, color: colors.textMuted }}>{outstandingNote(r)}</Text> : null}
              </View>
            ) : null}
            {retained?.placement==='active'?<RetainedTransportActions key={principalScope+JSON.stringify(retained)} requestId={r.id}/>:null}
            {!retained&&PICKUP_HANDOVER_ENABLED && (confirmed || history) ? <View style={{gap:spacing.sm}}>{legsFor(r).map(l=><PickupHandoverForm key={`${r.id}:${l.leg}:${tenantId}:${studioId}:${principalId}`} requestId={r.id} leg={l.leg} record={l.leg==="pickup"?r.pickupHandover:r.dropHandover} unavailable={r.handoverUnavailable} readOnly={history} onSaved={()=>void load()}/>)}</View> : null}
            {error && rows !== null && errId === r.id ? <Text style={{ ...typography.caption, color: colors.error }}>{error}</Text> : null}
            {!retained&&!history ? <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {r.status === "REQUESTED" ? <Button label="Confirm" size="md" fullWidth={false} disabled={busy !== null || block !== null} loading={busy === r.id} onPress={() => void setStatus(r, "CONFIRMED")} /> : null}
              {confirmed ? <Button label="Mark done" size="md" fullWidth={false} disabled={busy !== null} loading={busy === r.id} onPress={() => void setStatus(r, "DONE")} /> : null}
              <Button label="Decline" size="md" variant="secondary" fullWidth={false} disabled={busy !== null} loading={busy === r.id} onPress={() => void setStatus(r, "DECLINED")} />
            </View> : null}
          </View>
        );
      }}
    />
  );
}
