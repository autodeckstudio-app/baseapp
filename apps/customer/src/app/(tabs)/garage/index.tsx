// Garage: one lead car with its state, the rest compact (spec Â§6.4).
// Choosing a car makes it the active one on Home and opens its room.
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import type { Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { archiveVehicle, restoreVehicle, listenToMyArchivedVehicles, listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { setActiveVehicle } from "../../../hooks/useCustomerHome";
import { GarageCard } from "../../../ui/GarageCard";
import { CarThumb } from "../../../ui/CarThumb";
import { sceneImagery } from "../../../lib/imagery";
import { HeroImage, Button, CanvasTitle, Kicker, Loading, Notice, Pane, Plate, Screen, T } from "../../../ui/kit";

const CATEGORY: Record<string, string> = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", muv: "MUV", luxury: "Luxury", bike: "Bike" };

export default function GarageScreen() {
  const { colors: ink } = useExperienceTheme();
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
  const [error, setError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const uid = auth.status === "ready" ? auth.user.uid : null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;
  // Re-subscribes whenever the signed-in customer or tenant changes, and on manual retry.
  useEffect(() => {
    if (!uid || !tenantId) return;
    return listenToMyVehicles(uid, tenantId, (v) => { setVehicles(v); setError(false); }, () => setError(true));
  }, [uid, tenantId, retryTick]);

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
  const lead = list[0];

  return (
    <Screen header={<Text style={{ color: ink.textPrimary, fontSize: 26, fontWeight: "700" }}>Your cars</Text>}>
      {error ? <Notice title="Can't load your cars" body="Check your connection. We'll refresh as soon as we're back." action={<Button label="Try again" onPress={() => { setError(false); setVehicles(null); setRetryTick((t) => t + 1); }} />} /> : null}
      {removing ? (
        <Notice
          title={`Remove ${removing.registrationNumber} from your garage?`}
          body={removeError ?? "This archives the car. You can restore it later. Past services and invoices stay on record."}
          action={
            <View style={{ gap: space.breath }}>
              <Button label="Archive car" kind="danger" busy={removeBusy} onPress={() => void confirmRemove()} />
              <Button label="Keep it" kind="quiet" onPress={() => { setRemoving(null); setRemoveError(null); }} />
            </View>
          }
        />
      ) : null}
      {list.length > 0 ? (
        <View style={{ gap: space.breath }}>
          {list.map((v, i) => (
            <GarageCard key={v.id} photo={<CarThumb car={v} height={i === 0 ? 230 : 170} radius={0} />} height={i === 0 ? 230 : 170} kicker={i === 0 && list.length > 1 ? "Most recent" : undefined} title={`${v.make} ${v.model}`} lead={i === 0} plate={v.registrationNumber} chips={[v.year, v.color, v.category ? CATEGORY[v.category] : null].filter(Boolean).map(String)} onPress={() => open(v)} onRemove={() => { setRemoveError(null); setRemoving(v); }} />
          ))}
        </View>
      ) : !error ? (
        <Pane pad="none" round="hero">
          <HeroImage source={sceneImagery.heroAlt} />
          <View style={{ padding: space.inset, gap: space.breath }}>
            <T role="heading">No cars yet</T>
            <T tone="secondary">Add your car once. Bookings, bills and papers attach to it from then on.</T>
          </View>
        </Pane>
      ) : null}
      <Button kind={lead ? "quiet" : "primary"} label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} testID="garage-add" />
      <Button label="Service history and invoices" kind="quiet" onPress={()=>router.push("/(tabs)/garage/history")}/>
      {archiveActionError?<Notice title="Archived cars" body={archiveActionError} action={<View style={{gap:space.line}}>{archiveActionError.includes("booking")?<Button label="Open bookings to cancel" kind="quiet" onPress={()=>router.push("/(tabs)/bookings")}/>:null}<Button label="Retry" onPress={()=>{setArchiveActionError(null);setRetryTick(n=>n+1);}}/></View>}/>:null}
    </Screen>
  );
}
