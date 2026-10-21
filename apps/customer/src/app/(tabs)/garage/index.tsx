// Garage: one lead car with its state, the rest compact (spec §6.4).
// Choosing a car makes it the active one on Home and opens its room.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { segmentLabel } from "@autodeck/core";
import type { Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { archiveVehicle, restoreVehicle, listenToMyArchivedVehicles, listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { setActiveVehicle } from "../../../hooks/useCustomerHome";
import { CarThumb } from "../../../ui/CarThumb";
import { glassPane } from "../../../lib/glass-pane";
import { FilterPills } from "../../../ui/FilterPills";
import { dueChip } from "../../../lib/garage-due";
import { listenToMyJobs } from "../../../lib/job-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import type { ServiceJob } from "@autodeck/core";
import { metrics } from "../../../lib/metrics";
import { Button, Loading, Notice, Plate, Screen, T } from "../../../ui/kit";
import { GarageShowroom, CarPhotoCard } from "../../../ui/GarageShowroom";
import { TodayStrip } from "../../../ui/GarageToday";
import { StoryCircles } from "../../../ui/StoryCircles";
import { StoryViewer } from "../../../ui/StoryViewer";
import { useStoryTray } from "../../../hooks/useStoryTray";
import { CareRing } from "../../../ui/CareRing";
import { careRing, jobStep, liveJobForCar, LIVE_STEP_NAMES, readyBy } from "../../../lib/garage-live";
import { liveTrackTarget } from "../../../lib/bookings-view";
import { listenToMyMemberships } from "../../../lib/home-service";
import type { Membership } from "@autodeck/core";


function DueChip({ text }: { text: string }) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(128,128,128,0.14)", maxWidth: 150 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EC8638" }} />
      <Text numberOfLines={2} style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "700", flexShrink: 1 }}>{text}</Text>
    </View>
  );
}

export default function GarageScreen() {
  const { colors: ink, name: themeName } = useExperienceTheme();
  const auth = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [archived,setArchived]=useState<Vehicle[]>([]);
  const [showArchived,setShowArchived]=useState(false);
  const [archiveActionError,setArchiveActionError]=useState<string|null>(null);
  const [archiveActionBusy,setArchiveActionBusy]=useState<string|null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [svcMap, setSvcMap] = useState<Record<string, { id: string; name: string; category: string }>>({});
  const [plan, setPlan] = useState<Membership | null>(null);
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;
  const tray = useStoryTray(uid !== null);
  // Re-subscribes whenever the signed-in customer or tenant changes, and on manual retry.
  useEffect(() => {
    if (!uid || !tenantId) return;
    return listenToMyVehicles(uid, tenantId, (v) => { setVehicles(v); setError(false); }, () => setError(true));
  }, [uid, tenantId, retryTick]);

  useEffect(() => { if (!uid || !tenantId) return; return listenToMyJobs(tenantId, uid, setJobs, () => undefined); }, [uid, tenantId, retryTick]);
  useEffect(() => { if (!uid || !tenantId) return; return listenToMyMemberships(tenantId, uid, (ms) => setPlan(ms.find((m) => m.status === "active") ?? null), () => undefined); }, [uid, tenantId, retryTick]);
  useEffect(() => { void getServiceCatalogue().then((all) => { const m: Record<string, { id: string; name: string; category: string }> = {}; for (const x of all) m[x.id] = { id: x.id, name: x.name, category: x.category }; setSvcMap(m); }).catch(() => undefined); }, [retryTick]);
  useEffect(()=>{if(!uid||!tenantId)return;return listenToMyArchivedVehicles(uid,tenantId,setArchived,()=>setArchiveActionError("Could not load archived cars. Retry before restoring or deleting."));},[uid,tenantId,retryTick]);
  async function restore(v:Vehicle){setArchiveActionBusy(v.id);setArchiveActionError(null);try{await restoreVehicle(v.id);}catch(e){setArchiveActionError(e instanceof Error?e.message:"Could not restore the car.");}finally{setArchiveActionBusy(null);}}
  // Watchdog: if the vehicles stream never delivers (no data, no error),
  // show the connection notice instead of spinning forever.
  useEffect(() => {
    if (auth.status !== "ready") return;
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

  if (!vehicles && !error) return <Loading label="Opening your garage" />;
  const open = (v: Vehicle) => {
    void setActiveVehicle(v.id);
    router.push({ pathname: "/(tabs)/garage/[id]", params: { id: v.id } });
  };
  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      await archiveVehicle(removing.id);
      // Do not wait for the Firestore stream to catch up with the callable.
      setVehicles((current) => current?.filter((v) => v.id !== removing.id) ?? current);
      setRemoving(null);
    } catch {
      setRemoveError("We could not remove this car. Please try again.");
    } finally {
      setRemoveBusy(false);
    }
  }
  const list = [...(vehicles ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const sel = pick && list.some((v) => v.id === pick) ? pick : null; // null = the All view
  const one = sel ? list.find((v) => v.id === sel) ?? null : null;
  const light = themeName === "light";
  const chip = (v: Vehicle) => dueChip(jobs, v.id, svcMap);

  return (
    <Screen appBar="Garage">
      {error ? <Notice title="Can't load your cars" body="Check your connection. We'll refresh as soon as we're back." action={<Button label="Try again" onPress={() => { setError(false); setVehicles(null); setRetryTick((t) => t + 1); }} />} /> : null}
      <View style={{ gap: 12 }}>
      {list.length > 0 ? (
        <FilterPills outlined items={[{ key: null as string | null, label: "All" }, ...list.map((v) => ({ key: v.id as string | null, label: `${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber }))]} value={sel} onChange={setPick} trailing={<Pressable accessibilityRole="button" accessibilityLabel="Add a car" onPress={() => router.push("/(tabs)/garage/add")} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 7, borderWidth: 1, borderColor: light ? "rgba(22,24,28,0.18)" : "rgba(255,255,255,0.22)", backgroundColor: light ? "rgba(255,255,255,0.7)" : "transparent" }}><Text style={{ color: ink.textPrimary, fontSize: 13, fontWeight: "700" }}>+ Add</Text></Pressable>} />
      ) : null}
      {list.length > 0 && tray.groups.length > 0 ? <StoryCircles size={58} groups={tray.groups} seen={tray.seen} onOpen={tray.show} /> : null}
      {list.length === 0 && !error ? (
        <View style={{ ...glassPane(light), padding: metrics.cardPad, gap: space.breath }}>
          <T role="heading">No cars yet</T>
          <T tone="secondary">Add your car once. Bookings, bills and papers attach to it from then on.</T>
          <Button label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} testID="garage-add" />
        </View>
      ) : one ? (
        <View style={{ gap: metrics.sectionGap }}>
          <GarageShowroom cars={list} selectedId={one.id} onSelect={(id) => setPick(id)} onOpen={open} chipFor={(v) => (chip(v) ? <DueChip text={chip(v)!} /> : null)} />
          {liveJobForCar(jobs, one.id) ? <TodayStrip name={`${one.make ?? ""} ${one.model ?? ""}`.trim() || one.registrationNumber} job={liveJobForCar(jobs, one.id)!} ink={ink} light={light} onTrack={() => { const t = liveTrackTarget(liveJobForCar(jobs, one.id)!, null); router.push(t ? `/(tabs)/bookings/${t}` : "/(tabs)/bookings"); }} /> : null}
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
        <View style={{ gap: metrics.sectionGap }}>
          {(() => {
            const liveCar = list.find((v) => liveJobForCar(jobs, v.id));
            return liveCar ? <TodayStrip name={`${liveCar.make ?? ""} ${liveCar.model ?? ""}`.trim() || liveCar.registrationNumber} job={liveJobForCar(jobs, liveCar.id)!} ink={ink} light={light} onTrack={() => { const t = liveTrackTarget(liveJobForCar(jobs, liveCar.id)!, null); router.push(t ? `/(tabs)/bookings/${t}` : "/(tabs)/bookings"); }} /> : null;
          })()}
          {list.map((v) => (
            <CarPhotoCard key={v.id} car={v} height={liveJobForCar(jobs, v.id) ? 180 : 130} badge={liveJobForCar(jobs, v.id) ? "In the bay now" : chip(v)} onOpen={open} />
          ))}
          {list.some((v) => chip(v)) ? (
            <View style={{ ...glassPane(light), padding: metrics.cardPad, gap: 6 }}>
              <Text style={{ color: "#EC8638", fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }}>COMING UP</Text>
              {list.filter((v) => chip(v)).map((v) => (
                <View key={v.id} style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 6 }}>
                  <Text numberOfLines={1} style={{ flex: 1, color: ink.textPrimary, fontSize: 14 }}>{`${v.make ?? ""} ${v.model ?? ""}`.trim() || v.registrationNumber}</Text>
                  <Text numberOfLines={1} style={{ color: ink.textSecondary, fontSize: 13 }}>{chip(v)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      )}
      {list.length > 0 ? (
        <View style={{ gap: 9, paddingBottom: 100 }}>
          <Button label="Book a service" style={{ minHeight: 44, marginTop: 0 }} onPress={() => router.push("/(tabs)/catalogue")} />
          <Button label="Service history" kind="quiet" style={{ minHeight: 44, backgroundColor: "transparent", borderWidth: 1, borderColor: light ? "rgba(22,24,28,0.3)" : "rgba(255,255,255,0.3)", shadowOpacity: 0, elevation: 0 }} onPress={() => router.push(one ? { pathname: "/(tabs)/garage/history", params: { vehicleId: one.id } } : "/(tabs)/garage/history")} />
        </View>
      ) : null}
      {archiveActionError?<Notice title="Archived cars" body={archiveActionError} action={<View style={{gap:space.line}}>{archiveActionError.includes("booking")?<Button label="Open bookings to cancel" kind="quiet" onPress={()=>router.push("/(tabs)/bookings")}/>:null}<Button label="Retry" onPress={()=>{setArchiveActionError(null);setRetryTick(n=>n+1);}}/></View>}/>:null}
      </View>
      <StoryViewer group={tray.open} onClose={tray.close} onNextGroup={tray.next} onPrevGroup={tray.prev} />
    </Screen>
  );
}
