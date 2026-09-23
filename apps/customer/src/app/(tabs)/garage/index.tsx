// Garage: one lead car with its state, the rest compact (spec §6.4).
// Choosing a car makes it the active one on Home and opens its room.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { Vehicle } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { setActiveVehicle } from "../../../hooks/useCustomerHome";
import { Button, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T } from "../../../ui/kit";

const CATEGORY: Record<string, string> = { hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", muv: "MUV", luxury: "Luxury", bike: "Bike" };

export default function GarageScreen() {
  const auth = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyVehicles(auth.user.uid, auth.claims.tenantId, (v) => { setVehicles(v); setError(false); }, () => setError(true));
  }, [auth.status]);

  if (!vehicles && !error) return <Loading label="Opening your garage" />;
  const open = (v: Vehicle) => {
    void setActiveVehicle(v.id);
    router.push({ pathname: "/(tabs)/garage/[id]", params: { id: v.id } });
  };
  const list = [...(vehicles ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const [lead, ...rest] = list;

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Garage</Kicker><T role="title">Your cars</T></View>}>
      {error ? <Notice title="Can't load your cars" body="Check your connection. We'll refresh as soon as we're back." /> : null}
      {lead ? (
        <Pressable onPress={() => open(lead)} accessibilityRole="button" accessibilityLabel={`${lead.make} ${lead.model}`}>
          <Pane pad="inset" round="hero" fill="warm">
            <View style={{ gap: space.line }}>
              <Kicker tone="accent">{list.length > 1 ? "Most recent" : "Your car"}</Kicker>
              <T role="display" numberOfLines={1}>{lead.make} {lead.model}</T>
              <View style={{ flexDirection: "row", gap: space.breath, alignItems: "center", flexWrap: "wrap" }}>
                <Plate value={lead.registrationNumber} />
                <T role="caption" tone="tertiary">{[lead.year, lead.color, lead.category ? CATEGORY[lead.category] : null].filter(Boolean).join(" · ")}</T>
              </View>
              <T role="caption" tone="secondary">Open for visits, papers and warranties ›</T>
            </View>
          </Pane>
        </Pressable>
      ) : !error ? (
        <Notice title="No cars yet" body="Add your car once. Bookings, bills and papers attach to it from then on." />
      ) : null}
      {rest.length > 0 ? (
        <Pane pad="gap">
          {rest.map((v, i) => (
            <Row key={v.id} title={`${v.make} ${v.model}`} detail={<Plate value={v.registrationNumber} />} onPress={() => open(v)} last={i === rest.length - 1} />
          ))}
        </Pane>
      ) : null}
      <Button kind={lead ? "quiet" : "primary"} label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} testID="garage-add" />
    </Screen>
  );
}
