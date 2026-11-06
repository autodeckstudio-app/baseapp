// Car photo with explicit loading/error states: the customer's photo when there is one, otherwise a category placeholder.
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import type { Vehicle } from "@autodeck/core";
import { resolveVehiclePhotoUrl } from "../lib/vehicle-service";
import { photoKey, currentPhoto } from "./photo-state";
import { Icon } from "@autodeck/ui/native";

type Car = Pick<Vehicle, "photoUrl" | "category"> & { updatedAt?: string };

/** The car's own photo URL (cache-busted per save), or null while loading / when there is none. */
export function useVehiclePhotoUri(car: Car | null | undefined, nonce = 0): { uri: string | null; failed: boolean } {
  const [resolved, setResolved] = useState<{ key: string; uri: string } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const path = car?.photoUrl ?? null;
  const version = car?.updatedAt ?? null;
  const key = photoKey(path, version);
  useEffect(() => {
    let alive = true;
    setResolved(null);
    setFailedKey(null);
    // The resolver's security checks stay untouched: a rejection only flips THIS
    // path/version to a truthful failure, never a retry loop or a bypass.
    if (path) void resolveVehiclePhotoUrl(path, version).then((u) => { if (alive) setResolved({ key, uri: u }); }).catch(() => {
      if (typeof __DEV__ !== "undefined" && __DEV__) console.warn("CarThumb: saved photo could not be read", { path });
      if (alive) setFailedKey(key);
    });
    return () => { alive = false; };
  }, [path, version, key, nonce]);
  // Effects run after paint. Never return the prior car/version for even one frame.
  return { uri: currentPhoto(resolved, key), failed: failedKey === key };
}

export function CarThumb({ car, height, width, radius = 16 }: { car: Car | undefined; height: number; width?: number | `${number}%`; radius?: number }) {
  const [nonce, setNonce] = useState(0);
  const { uri, failed } = useVehiclePhotoUri(car, nonce);
  // Refresh before the private reader's ten-minute expiry. Path/version identity
  // still prevents a previous car or save from painting while the URL refreshes.
  useEffect(()=>{if(!uri)return;const timer=setTimeout(()=>setNonce(n=>n+1),9*60*1000);return()=>clearTimeout(timer)},[uri]);
  const key = photoKey(car?.photoUrl ?? null, car?.updatedAt ?? null);
  // P4 signed URLs live 10 minutes: on a load failure re-resolve ONCE for a fresh
  // URL before falling back to the placeholder. The budget is keyed to the photo
  // (path+version), not the URL: a fresh signed URL always differs, so a URL-keyed
  // budget would retry forever when the object itself is unreadable.
  const [retriedKey, setRetriedKey] = useState<string | null>(null);
  const [imgFailedKey, setImgFailedKey] = useState<string | null>(null);
  // Generation guard: an <img> error callback captures the render it came from. A stale
  // firing (previous car/version, a superseded signed URL, or an earlier attempt at the
  // SAME URL after a cached-refresh retry) must never spend the current photo's retry or
  // move its terminal state. attemptGen increments monotonically per image attempt, so
  // key+URI identity alone can never authenticate an old callback.
  const attemptGen = useRef(0);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; attemptGen.current += 1; }, []);
  const gen = attemptGen.current; // bound at render: every callback of this render carries THIS attempt
  const liveRef = useRef({ key, uri, retriedKey, gen: 0 });
  liveRef.current = { key, uri, retriedKey, gen };
  const onImgError = (failedUri: string, failedGen: number) => {
    const live = liveRef.current;
    if (!mountedRef.current || !live.uri || failedUri !== live.uri || live.key !== key || failedGen !== live.gen) return; // stale element, generation, or unmounted
    if (live.retriedKey !== live.key) { attemptGen.current += 1; setRetriedKey(live.key); setNonce((n) => n + 1); return; }
    setImgFailedKey(live.key);
  };
  const hasPhoto = !!uri && imgFailedKey !== key;
  // True when the saved photo cannot be shown: the resolver rejected it or the image budget ran out.
  const unavailable = failed || imgFailedKey === key;
  // A saved photo is loading, not absent. Do not paint a different/old car. When resolving it
  // FAILED, stop pending forever: fall back to the placeholder and say the photo is unavailable.
  const pending = !!car?.photoUrl && !uri && !failed;
  return (
    <View style={{ width: width ?? "100%", height, borderRadius: radius, overflow: "hidden" }}>
      {!pending && hasPhoto ? <FadeImage key={`${key}:${uri}:${gen}`} source={{ uri: uri as string }} resizeMode="cover" onError={() => onImgError(uri as string, gen)} style={{ width: "100%", height: "100%" }} /> : null}
      {!pending && !hasPhoto ? <View style={{ width: "100%", height: "100%", alignItems: "center", justifyContent: height >= 100 ? "flex-start" : "center", paddingTop: height >= 100 ? Math.round(height * 0.2) : 0, gap: 4, backgroundColor: height >= 100 ? "#23232A" : "rgba(127,127,135,0.14)" }}>{height >= 100 ? <Text style={{ color: "#B4B2BB", fontSize: 12, fontWeight: "700", letterSpacing: 1.2 }}>{unavailable ? "PHOTO UNAVAILABLE" : "NO PHOTO YET"}</Text> : <Icon name="car" color="#8A8A92" size={Math.max(18, Math.min(34, height / 3))} />}</View> : null}
    </View>
  );
}
