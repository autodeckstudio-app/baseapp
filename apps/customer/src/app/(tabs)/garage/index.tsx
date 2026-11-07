import { JourneySheet } from "../../../ui/JourneySheet";
import { SceneIntro } from "../../../ui/SceneIntro";
// Garage: one lead car with its state, the rest compact (spec §6.4).
// Choosing a car makes it the active one on Home and opens its room.
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { segmentLabel } from "@autodeck/core";
import type { Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { deleteVehiclePermanently, restoreVehicle, listenToMyArchivedVehicles, listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { setActiveVehicle } from "../../../hooks/useCustomerHome";
import { CarThumb } from "../../../ui/CarThumb";
import { glassPane } from "../../../lib/glass-pane";
import { FilterPills } from "../../../ui/FilterPills";
import { compactDueChip, dueChip } from "../../../lib/garage-due";
import { listenToMyJobs } from "../../../lib/job-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import type { ServiceJob } from "@autodeck/core";
import { metrics } from "../../../lib/metrics";
import { Button, Loading, Notice, Plate, Screen, T } from "../../../ui/kit";
import { GarageShowroom } from "../../../ui/GarageShowroom";
import { CareRing } from "../../../ui/CareRing";
import { careRing, jobStep, liveJobForCar, LIVE_STEP_NAMES, readyBy } from "../../../lib/garage-live";
import { liveTrackTarget } from "../../../lib/bookings-view";
import { listenToMyMemberships } from "../../../lib/home-service";
import type { Membership } from "@autodeck/core";
import { devGarage } from "../../../lib/dev-garage-loader";


function DueChip({ text }: { text: string }) {
  return (
    <View accessible accessibilityLabel={text} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "#FFFFFF", maxWidth: 180 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EC8638" }} />
      <Text numberOfLines={1} style={{ color: "#1D1B26", fontSize: 11, fontWeight: "700", flexShrink: 1 }}>{compactDueChip(text)}</Text>
    </View>
  );
}

export default function GarageScreen() {
  const { colors: ink, name: themeName } = useExperienceTheme();
  const auth = useAuth();
  const router = useRouter();
  const q = useLocalSearchParams<{ mock?: string; live?: string; pick?: string; empty?: string }>();
  const mock = __DEV__ && devGarage && q.mock === "1" ? devGarage({ live: !!q.live, empty: !!q.empty }) : null; // dev preview only: sample cars, never real data
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(mock ? mock.vehicles : null);
  const [archived,setArchived]=useState<Vehicle[]>([]);
  const [showArchived,setShowArchived]=useState(false);
  const [archiveActionError,setArchiveActionError]=useState<string|null>(null);
  const [archiveActionBusy,setArchiveActionBusy]=useState<string|null>(null);
  const [photoCleanupNote,setPhotoCleanupNote]=useState<string|null>(null);
  const [deleting, setDeleting] = useState<Vehicle | null>(null);
  const [pick, setPick] = useState<string | null>(mock ? q.pick ?? null : null);
  const [jobs, setJobs] = useState<ServiceJob[]>(mock ? mock.jobs : []);
  const [svcMap, setSvcMap] = useState<Record<string, { id: string; name: string; category: string }>>(mock ? mock.svcMap : {});
  const [plan, setPlan] = useState<Membership | null>(mock ? mock.plan : null);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const uid = auth.status === "ready" ? auth.customerDocId : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;
  // Truthful owner states: a null canonical id is never a connectivity
  // problem. "error" = resolution failed, state UNKNOWN (do not show empty);
  // "absent"/"claim-required" for a customer = profile still linking;
  // staff with verifiably no record genuinely have an empty garage.
  const ownerUnknown = auth.status === "ready" && !uid && auth.customerDocResolution === "error";
  const ownerLinking = auth.status === "ready" && !uid && auth.customerDocResolution !== "error" && auth.claims.role === "customer";
  const ownerMissing = auth.status === "ready" && !uid;
  const ownerKey=JSON.stringify([uid,tenantId,auth.status==='ready'?auth.user.uid:null]);const ownerRef=useRef(ownerKey);ownerRef.current=ownerKey;const archiveLock=useRef(false),archiveGeneration=useRef(0);
  useEffect(()=>{archiveGeneration.current++;archiveLock.current=false;setArchiveActionBusy(null);return()=>{archiveGeneration.current++}},[ownerKey]);
  // Re-subscribes whenever the signed-in customer or tenant changes, and on manual retry.
  useEffect(() => {
    if(mock)return;setVehicles(null);setPick(null);setDeleting(null);setArchiveActionError(null);setPhotoCleanupNote(null);setError(false);if (!uid || !tenantId) return;let alive=true;
    const stop=listenToMyVehicles(uid, tenantId, (v) => {if(alive){setVehicles(v); setError(false)}}, () => {if(alive)setError(true)});return()=>{alive=false;stop()};
  }, [uid, tenantId, retryTick]);

  useEffect(() => { if(mock)return;setJobs([]);if (!uid || !tenantId) return;let alive=true;const stop=listenToMyJobs(tenantId, uid, v=>{if(alive)setJobs(v)}, () => undefined);return()=>{alive=false;stop()}; }, [uid, tenantId, retryTick]);
  useEffect(() => { if(mock)return;setPlan(null);if (!uid || !tenantId) return;let alive=true;const stop=listenToMyMemberships(tenantId, uid, (ms) => {if(alive)setPlan(ms.find((m) => m.status === "active") ?? null)}, () => undefined);return()=>{alive=false;stop()}; }, [uid, tenantId, retryTick]);
  useEffect(() => { if (mock) return; void getServiceCatalogue().then((all) => { const m: Record<string, { id: string; name: string; category: string }> = {}; for (const x of all) m[x.id] = { id: x.id, name: x.name, category: x.category }; setSvcMap(m); }).catch(() => undefined); }, [retryTick]);
  useEffect(()=>{if(mock)return;setArchived([]);setShowArchived(false);if(!uid||!tenantId)return;let alive=true;const stop=listenToMyArchivedVehicles(uid,tenantId,v=>{if(alive)setArchived(v)},()=>{if(alive)setArchiveActionError("Could not load archived cars. Retry before restoring or deleting.")});return()=>{alive=false;stop()};},[uid,tenantId,retryTick]);
  async function restore(v:Vehicle){if(archiveLock.current)return;const owner=ownerKey,gen=archiveGeneration.current;const current=()=>ownerRef.current===owner&&archiveGeneration.current===gen;archiveLock.current=true;setArchiveActionBusy(v.id);setArchiveActionError(null);try{await restoreVehicle(v.id);}catch(e){if(current())setArchiveActionError(e instanceof Error?e.message:"The restore was not confirmed. Refresh before trying again.");}finally{if(current()){archiveLock.current=false;setArchiveActionBusy(null);}}}

  // Watchdog: if the vehicles stream never delivers (no data, no error),
  // show the connection notice instead of spinning forever.
  useEffect(() => {
    if (auth.status !== "ready") return;
    if (!uid) return; // no owner key is an account state, never a connection failure
    if (vehicles !== null) return;
    const t = setTimeout(() => {
      setVehicles((v) => {
        if (v !== null) return v;
        setError(true);
        return v;
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [auth.status, retryTick, vehicles]);

  const { height: winH } = useWindowDimensions();
  const swipeList = [...(vehicles ?? [])].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const pickRef = useRef(pick); pickRef.current = pick;

  if (!vehicles && !error && !ownerMissing) return <Loading label="Opening your garage" />;
  const open = (v: Vehicle) => {
    void setActiveVehicle(v.id);
    router.push({ pathname: "/(tabs)/garage/[id]", params: { id: v.id } });
  };
  async function confirmDeletePermanently() {
    if (!deleting||archiveLock.current) return;
    const owner=ownerKey,gen=archiveGeneration.current;const current=()=>ownerRef.current===owner&&archiveGeneration.current===gen;archiveLock.current=true;
    setArchiveActionBusy(deleting.id);
    setArchiveActionError(null);
    try {
      const outcome = await deleteVehiclePermanently(deleting.id);
      if(!current())return;
      // Do not wait for the archived stream to catch up with the callable.
      setArchived((previous) => previous.filter((v) => v.id !== deleting.id));
      setDeleting(null);
      if (outcome.photoCleanupFailed) {
        // The car is deleted; only the cover-photo sweep failed. It retries
        // automatically, so say pending rather than claiming it is removed.
        setPhotoCleanupNote("Car deleted. Its cover photo could not be removed yet - we will keep trying to remove it. Documents, service history, bills and inspection photos are kept.");
      }
    } catch (e) {
      if(current())setArchiveActionError(e instanceof Error ? e.message : "The delete was not confirmed. Refresh before trying again.");
    } finally {
      if(current()){archiveLock.current=false;setArchiveActionBusy(null);}
    }
  }
  const list = [...(vehicles ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sel = pick && list.some((v) => v.id === pick) ? pick : null; // null = the All view
  const one = sel ? list.find((v) => v.id === sel) ?? null : null;
  const light = themeName === "light";
  const chip = (v: Vehicle) => dueChip(jobs, v.id, svcMap);
  // One chip on the card, nothing below it: Track when the car is in the bay, otherwise what is due.
  const overlay = (v: Vehicle) => {
    const lj = liveJobForCar(jobs, v.id);
    if (lj) return <Pressable accessibilityRole="button" accessibilityLabel="Track" hitSlop={8} onPress={() => { const t = liveTrackTarget(lj, null); router.push(t ? `/(tabs)/bookings/${t}` : "/(tabs)/bookings"); }} style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "rgba(255,255,255,0.92)" }}><Text style={{ color: "#1D1B26", fontSize: 12, fontWeight: "800" }}>{`${LIVE_STEP_NAMES[jobStep(lj.status)]} · Track`}</Text></Pressable>;
    return chip(v) ? <DueChip text={chip(v)!} /> : null;
  };

  return (
    <Screen appBar="Garage">
      <SceneIntro eyebrow="Your garage" compact title="Your cars, connected."/>
      <View testID="garage-swipe-area" style={{ gap: 20, minHeight: Math.max(winH - 240, 400) }}>
      {ownerUnknown ? <Notice title="We couldn't confirm your profile" body="This is not your connection - we could not check your account. Try again in a moment; your cars are not affected." action={<Button label="Try again" onPress={() => { setError(false); setVehicles(null); setRetryTick((t) => t + 1); }} />} /> : null}
      {ownerLinking ? <Notice title="Your profile is still linking" body="Try again once it is ready." action={<Button label="Try again" onPress={() => { setError(false); setVehicles(null); setRetryTick((t) => t + 1); }} />} /> : null}
      {error ? <Notice title="Can't load your cars" body="Check your connection. We'll refresh as soon as we're back." action={<Button label="Try again" onPress={() => { setError(false); setVehicles(null); setRetryTick((t) => t + 1); }} />} /> : null}
      {list.length > 0 ? (
        <FilterPills fixedFirst items={[{ key: null as string | null, label: "All" }, ...list.map((v) => ({ key: v.id as string | null, label: `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber }))]} value={sel} onChange={setPick} flat trailing={<Pressable accessibilityRole="button" accessibilityLabel="Add a car" onPress={() => router.push("/(tabs)/garage/add")} style={{ paddingHorizontal: 2, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 4 }}><Text style={{ color: ink.premium, fontSize: 16, fontWeight: "800" }}>+</Text><Text style={{ color: ink.textPrimary, fontSize: 13, fontWeight: "700" }}>Add car</Text></Pressable>} />
      ) : null}
      {list.length === 0 && !error && !ownerUnknown && !ownerLinking ? (
        <View style={{ ...glassPane(light), padding: metrics.cardPad, gap: space.breath }}>
          <T role="heading">No cars yet</T>
          <T tone="secondary">Add your car once. Bookings, bills and papers attach to it from then on.</T>
          <Button label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} testID="garage-add" />
        </View>
      ) : one ? (
        <View style={{ gap: metrics.sectionGap }}>
          <View>
            <GarageShowroom cars={list} selectedId={one.id} onSelect={(id) => setPick(id)} onOpen={open} chipFor={overlay} />
          </View>
          {careRing(plan) ? (() => {
            const r = careRing(plan)!;
            return (
              <View style={{ ...glassPane(light), padding: metrics.cardPad, flexDirection: "row", alignItems: "center", gap: 14 }}>
                <CareRing fraction={r.fraction} left={r.left} total={r.total} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>CARE PLAN</Text>
                  <Text numberOfLines={1} style={{ color: ink.textPrimary, fontSize: 16, fontWeight: "800" }}>{r.line}</Text>
                  <Text style={{ color: ink.textSecondary, fontSize: 13 }}>{r.sub}</Text>
                </View>
              </View>
            );
          })() : null}
        </View>
      ) : (
        // "All" is the garage floor itself: every car on the floor, swipe to move focus
        // between them, tap one to open its room. Swiping does not select; the pills above do.
        <GarageShowroom cars={list} selectedId={null} onSelect={(id) => setPick(id)} onOpen={open} chipFor={overlay} />
      )}
      {list.length > 0 ? (
        <View style={{ gap: space.breath, marginTop: metrics.sectionGap }}>
          <Button label="Book a service" onPress={() => router.push("/(tabs)/catalogue")} />
          <Button label="Service history" kind="quiet" onPress={() => router.push(one ? { pathname: "/(tabs)/garage/history", params: { vehicleId: one.id } } : "/(tabs)/garage/history")} />
        </View>
      ) : null}
      <JourneySheet kind="garage"/>
      {archived.length > 0 ? (
        <View style={{ ...glassPane(light), padding: metrics.cardPad, gap: space.line }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Archived cars" onPress={() => setShowArchived((v) => !v)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T role="heading">Archived cars ({archived.length})</T>
            <T tone="secondary">{showArchived ? "Hide" : "Show"}</T>
          </Pressable>
          {showArchived ? archived.map((v) => (
            <View key={v.id} style={{ gap: 6, paddingVertical: 6, borderTopWidth: 1, borderTopColor: "rgba(128,128,128,0.18)" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <CarThumb car={v} height={44} width={60} radius={8} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T role="heading">{`${v.make ?? ""} ${v.model ?? ""}`.trim() || "Car"}</T>
                  <Plate value={v.registrationNumber} />
                </View>
              </View>
              {deleting?.id === v.id ? (
                <View style={{ gap: 8 }}>
                  <T tone="secondary">Delete this car forever? Its cover photo will be removed. Documents, service history, bills and inspection photos are kept. This cannot be undone.</T>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <Button label="Yes, delete forever" kind="danger" busy={archiveActionBusy === v.id} onPress={() => void confirmDeletePermanently()} />
                    <Button label="Keep it" kind="quiet" onPress={() => setDeleting(null)} />
                  </View>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Button label="Restore" kind="quiet" busy={archiveActionBusy === v.id} onPress={() => void restore(v)} />
                  <Button label="Delete permanently" kind="danger" onPress={() => setDeleting(v)} />
                </View>
              )}
            </View>
          )) : null}
        </View>
      ) : null}
      {photoCleanupNote?<Notice title="Photo removal pending" body={photoCleanupNote} action={<Button label="Got it" kind="quiet" onPress={()=>setPhotoCleanupNote(null)}/>}/>:null}
      {archiveActionError?<Notice title="Archived cars" body={archiveActionError} action={<View style={{gap:space.line}}>{archiveActionError.includes("booking")?<Button label="Open bookings to cancel" kind="quiet" onPress={()=>router.push("/(tabs)/bookings")}/>:null}<Button label="Retry" onPress={()=>{setArchiveActionError(null);setRetryTick(n=>n+1);}}/></View>}/>:null}
      </View>
    </Screen>
  );
}
