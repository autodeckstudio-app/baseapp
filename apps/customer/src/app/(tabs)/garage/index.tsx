// Garage: one lead car with its state, the rest compact (spec Â§6.4).
// Choosing a car makes it the active one on Home and opens its room.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon } from "@autodeck/ui/native";
import { archiveVehicle, listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { setActiveVehicle } from "../../../hooks/useCustomerHome";
import { CarThumb } from "../../../ui/CarThumb";
import { sceneImagery } from "../../../lib/imagery";
import { HeroImage, Button, Kicker, Loading, Notice, Pane, Plate, Screen, T } from "../../../ui/kit";

const CATEGORY: Record<string, string> = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", muv: "MUV", luxury: "Luxury", bike: "Bike" };

export default function GarageScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
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
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Garage</Kicker><T role="title">Your cars</T></View>}>
      {error ? <Notice title="Can't load your cars" body="Check your connection. We'll refresh as soon as we're back." action={<Button label="Try again" onPress={() => { setError(false); setVehicles(null); setRetryTick((t) => t + 1); }} />} /> : null}
      {removing ? (
        <Notice
          title={`Remove ${removing.registrationNumber} from your garage?`}
          body={removeError ?? "Service history stays on record."}
          action={
            <View style={{ gap: space.breath }}>
              <Button label="Yes, remove" kind="danger" busy={removeBusy} onPress={() => void confirmRemove()} />
              <Button label="Keep it" kind="quiet" onPress={() => { setRemoving(null); setRemoveError(null); }} />
            </View>
          }
        />
      ) : null}
      {list.length > 0 ? (
        <View style={{ gap: space.breath }}>
          {list.map((v, i) => (
            <Pressable key={v.id} onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`${v.make} ${v.model}`} style={({ pressed }) => ({ width: "100%", borderRadius: 28, overflow: "hidden", backgroundColor: "rgba(255,255,255,.045)", ...({ backgroundImage: "linear-gradient(145deg,rgba(255,255,255,.10),rgba(255,255,255,.03))", backdropFilter: "blur(26px) saturate(170%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.22),0 24px 60px -18px rgba(0,0,0,.65)" } as object), borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", opacity: pressed ? 0.85 : 1 })}>
              <CarThumb car={v} height={i === 0 ? 230 : 170} radius={0} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, height: i === 0 ? 230 : 170, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0.45) 0%, rgba(5,5,6,0) 35%, rgba(5,5,6,0.88) 100%)" } as object) }} />
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); setRemoveError(null); setRemoving(v); }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${v.registrationNumber} from your garage`}
                hitSlop={8}
                style={({ pressed }) => ({ position: "absolute", top: 12, right: 12, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="close" color="#F6F4F1" size={16} />
              </Pressable>
              <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, top: (i === 0 ? 230 : 170) - 64, gap: 4 }}>
                {i === 0 && list.length > 1 ? <T role="label" tone="accent">Most recent</T> : null}
                <T role={i === 0 ? "heading" : "bodyStrong"} numberOfLines={1} style={{ color: "#FFFFFF" }}>{v.make} {v.model}</T>
              </View>
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", padding: space.line }}>
                <Plate value={v.registrationNumber} />
                {[v.year, v.color, v.category ? CATEGORY[v.category] : null].filter(Boolean).map((t) => (
                  <View key={String(t)} style={{ borderRadius: 9999, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.05)", paddingHorizontal: 10, paddingVertical: 4 }}>
                    <T role="caption" tone="secondary" style={{ textTransform: "capitalize" }}>{String(t)}</T>
                  </View>
                ))}
              </View>
            </Pressable>
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
    </Screen>
  );
}
