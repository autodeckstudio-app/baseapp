// A car picture that never breaks: the customer's photo when there is one, otherwise a category placeholder.
import { useEffect, useState } from "react";
import { Image, View } from "react-native";
import type { Vehicle } from "@autodeck/core";
import { resolveVehiclePhotoUrl } from "../lib/vehicle-service";
import { vehicleImagery } from "../lib/imagery";

type Car = Pick<Vehicle, "photoUrl" | "category">;

export function CarThumb({ car, height, width, radius = 16 }: { car: Car | undefined; height: number; width?: number | `${number}%`; radius?: number }) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const path = car?.photoUrl ?? null;
  useEffect(() => {
    let alive = true;
    setUri(null);
    setFailed(false);
    if (path) void resolveVehiclePhotoUrl(path).then((u) => { if (alive) setUri(u); }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [path]);
  const fallback = vehicleImagery[(car?.category ?? "sedan") as keyof typeof vehicleImagery] ?? vehicleImagery.sedan;
  const source = uri && !failed ? { uri } : fallback;
  return (
    <View style={{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden" }}>
      <Image source={source} resizeMode="cover" onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
