// A car picture that never breaks: the customer's photo when there is one, otherwise a category placeholder.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import type { Vehicle } from "@autodeck/core";
import { resolveVehiclePhotoUrl } from "../lib/vehicle-service";
import { photoKey, currentPhoto } from "./photo-state";
import { Icon } from "@autodeck/ui/native";

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
  const hasPhoto = !!uri && failedUri !== uri;
  // A saved photo is loading, not absent. Do not paint a different/old car.
  const pending = !!car?.photoUrl && !uri;
  return (
    <View style={{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden" }}>
      {!pending && hasPhoto ? <FadeImage key={uri} source={{ uri: uri as string }} resizeMode="cover" onError={() => setFailedUri(uri)} style={{ width: "100%", height: "100%" }} /> : null}
      {!pending && !hasPhoto ? <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: height >= 100 ? "flex-start" : "center", paddingTop: height >= 100 ? Math.round(height * 0.2) : 0, gap: 4, backgroundColor: "rgba(127,127,135,0.14)" }}>{height >= 100 ? <><Text style={{ color: "#6B6B73", fontSize: 14, fontWeight: "700" }}>No photo</Text><Text style={{ color: "#6B6B73", fontSize: 12 }}>Add one from the car page</Text></> : <Icon name="car" color="#8A8A92" size={Math.max(18, Math.min(34, height / 3))} />}</View> : null}
    </View>
  );
}
