// A car picture that never breaks: the customer's photo when there is one, otherwise a category placeholder.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import type { Vehicle } from "@autodeck/core";
import { resolveVehiclePhotoUrl } from "../lib/vehicle-service";
import { vehicleImagery } from "../lib/imagery";

type Car = Pick<Vehicle, "photoUrl" | "category"> & { updatedAt?: string };

/** The car's own photo URL (cache-busted per save), or null while loading / when there is none. */
export function useVehiclePhotoUri(car: Car | null | undefined): string | null {
  const [uri, setUri] = useState<string | null>(null);
  const path = car?.photoUrl ?? null;
  const version = car?.updatedAt ?? null;
  useEffect(() => {
    let alive = true;
    setUri(null);
    if (path) void resolveVehiclePhotoUrl(path, version).then((u) => { if (alive) setUri(u); }).catch(() => undefined);
    return () => { alive = false; };
  }, [path, version]);
  return uri;
}

export function CarThumb({ car, height, width, radius = 16 }: { car: Car | undefined; height: number; width?: number | `${number}%`; radius?: number }) {
  const uri = useVehiclePhotoUri(car);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [uri]);
  const fallback = vehicleImagery[(car?.category ?? "sedan") as keyof typeof vehicleImagery] ?? vehicleImagery.sedan;
  const source = uri && !failed ? { uri } : fallback;
  return (
    <View style={{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden" }}>
      <FadeImage key={uri ?? "fb"} source={source} resizeMode="cover" onError={() => setFailed(true)} style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
