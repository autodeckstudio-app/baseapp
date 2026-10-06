// A car picture that never breaks: the customer's photo when there is one, otherwise a category placeholder.
import { useEffect, useState } from "react";
import { View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import type { Vehicle } from "@autodeck/core";
import { resolveVehiclePhotoUrl } from "../lib/vehicle-service";
import { photoKey, currentPhoto } from "./photo-state";
import { vehicleImagery } from "../lib/imagery";

type Car = Pick<Vehicle, "photoUrl" | "category"> & { updatedAt?: string };

/** The car's own photo URL (cache-busted per save), or null while loading / when there is none. */
export function useVehiclePhotoUri(car: Car | null | undefined): string | null {
  const [resolved, setResolved] = useState<{ key: string; uri: string } | null>(null);
  const path = car?.photoUrl ?? null;
  const version = car?.updatedAt ?? null;
  const key = photoKey(path, version);
  useEffect(() => {
    let alive = true;
    setResolved(null);
    if (path) void resolveVehiclePhotoUrl(path, version).then((u) => { if (alive) setResolved({ key, uri: u }); }).catch(() => undefined);
    return () => { alive = false; };
  }, [path, version, key]);
  // Effects run after paint. Never return the prior car/version for even one frame.
  return currentPhoto(resolved, key);
}

export function CarThumb({ car, height, width, radius = 16 }: { car: Car | undefined; height: number; width?: number | `${number}%`; radius?: number }) {
  const uri = useVehiclePhotoUri(car);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const fallback = vehicleImagery[(car?.category ?? "sedan") as keyof typeof vehicleImagery] ?? vehicleImagery.sedan;
  const source = uri && failedUri !== uri ? { uri } : fallback;
  // A saved photo is loading, not absent. Do not paint a different/old car.
  const pending = !!car?.photoUrl && !uri;
  return (
    <View style={{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden" }}>
      {!pending ? <FadeImage key={uri ?? "fb"} source={source} resizeMode="cover" onError={() => setFailedUri(uri)} style={{ width: "100%", height: "100%" }} /> : null}
    </View>
  );
}
