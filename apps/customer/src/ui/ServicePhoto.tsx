// One image block for any service: a product shot on a tinted panel (brand bottles) or a cover photo.
import { useState } from "react";
import { Image, View } from "react-native";
import { FadeImage, Icon } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { serviceVisual } from "../lib/imagery";

type Svc = { name: string; brand?: string | null; category: string; imageUrl?: string | null };

/** Garage services have no brand photo. One clean icon tile each, so no card repeats a picture. */
export function garageIconFor(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes("alignment") || n.includes("tyre") || n.includes("wheel")) return "car";
  if (n.includes("ac ")) return "tools";
  if (n.includes("battery")) return "check";
  if (n.includes("repair")) return "wrench";
  return "inspect";
}

export function ServicePhoto({ service, height, width, radius = 0, aspect }: { service: Svc; height?: number; width?: number | `${number}%`; radius?: number; aspect?: number }) {
  const v = serviceVisual(service);
  const [bad, setBad] = useState(false);
  const box = { width: width ?? ("100%" as const), ...(height ? { height } : {}), ...(aspect ? { aspectRatio: aspect } : {}), borderRadius: radius, overflow: "hidden" as const };
  if (service.imageUrl && !bad) {
    return (
      <View style={box}>
        <FadeImage onError={() => setBad(true)} source={{ uri: service.imageUrl }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      </View>
    );
  }
  if (service.category === "garage") {
    return (
      <View style={[box, { backgroundColor: "#15171B", alignItems: "center", justifyContent: "center" }]}>
        <View style={{ position: "absolute", width: "70%", aspectRatio: 1, borderRadius: 999, backgroundColor: "rgba(236,134,56,0.16)" }} />
        <Icon name={garageIconFor(` ${service.name} `)} color="#F4F1EC" size={44} />
      </View>
    );
  }
  if (v.bottle) {
    return (
      <View style={[box, { backgroundColor: "#F3EFE8", alignItems: "center", justifyContent: "center" }]}>
        <Image source={v.bottle.src} resizeMode="contain" style={{ width: "62%", height: "88%" }} />
      </View>
    );
  }
  return (
    <View style={box}>
      <Image source={v.photo} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
    </View>
  );
}
