// Garage: one lead car with its state, the rest compact (spec §6.4).
// Choosing a car makes it the active one on Home and opens its room.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Icon } from "@autodeck/ui/native";
import { archiveVehicle, listenToMyVehicles, resolveVehiclePhotoUrl } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { setActiveVehicle } from "../../../hooks/useCustomerHome";
import { CarThumb } from "../../../ui/CarThumb";
import { sceneImagery } from "../../../lib/imagery";
import { HeroImage, Button, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";

const CATEGORY: Record<string, string> = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", muv: "MUV", luxury: "Luxury", bike: "Bike" };

export default function GarageScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [leadPhoto, setLeadPhoto] = useState<string | null>(null);
  const leadPath = [...(vehicles ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]?.photoUrl ?? null;
  useEffect(() => {
    let alive = true;
    setLeadPhoto(null);
    if (leadPath) void resolveVehiclePhotoUrl(leadPath).then((u) => { if (alive) setLeadPhoto(u); }).catch(() => {});
    return () => { alive = false; };
  }, [leadPath]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyVehicles(auth.user.uid, auth.claims.tenantId, (v) => { setVehicles(v); setError(false); }, () => setError(true));
  }, [auth.status]);

  // Watchdog: if the vehicles stream never delivers (no data, no error),
  // show the connection notice instead of spinning forever.
  useEffect(() => {
    if (auth.status !== "ready") return;
    const t = setTimeout(() => {
      setVehicles((v) => {
        if (v !== null) return v;
        setError(true);
        return v;
      });
    }, 8000);
    return () => clearTimeout(t);
  }, [auth.status]);

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
      {error ? <Notice title="Can't load your cars" body="Check your connection. We'll refresh as soon as we're back." /> : null}
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
            <Pressable key={v.id} onPress={() => open(v)} accessibilityRole="button" accessibilityLabel={`${v.make} ${v.model}`} style={({ pressed }) => ({ width: "100%", borderRadius: 22, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", opacity: pressed ? 0.85 : 1 })}>
              <CarThumb car={v} height={i === 0 ? 190 : 140} radius={0} />
              <Pressable
                onPress={(e) => { e.stopPropagation?.(); setRemoveError(null); setRemoving(v); }}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${v.registrationNumber} from your garage`}
                hitSlop={8}
                style={({ pressed }) => ({ position: "absolute", top: 10, right: 10, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.85)", opacity: pressed ? 0.7 : 1 })}
              >
                <Icon name="close" color="#2E2E33" size={16} />
              </Pressable>
              <View style={{ gap: space.hair, padding: space.inset }}>
                {i === 0 && list.length > 1 ? <Kicker tone="accent">Most recent</Kicker> : null}
                <T role={i === 0 ? "heading" : "bodyStrong"} numberOfLines={1}>{v.make} {v.model}</T>
                <View style={{ flexDirection: "row", gap: space.breath, alignItems: "center", flexWrap: "wrap" }}>
                  <Plate value={v.registrationNumber} />
                  <T role="caption" tone="tertiary" numberOfLines={1}>{[v.year, v.color, v.category ? CATEGORY[v.category] : null].filter(Boolean).join(" · ")}</T>
                </View>
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
