// One image block for any service: a product shot on a tinted panel (brand bottles) or a cover photo.
import { Image, View } from "react-native";
import { FadeImage } from "@autodeck/ui/native";
import { serviceVisual } from "../lib/imagery";

type Svc = { name: string; brand?: string | null; category: string; imageUrl?: string | null };

export function ServicePhoto({ service, height, width, radius = 0, aspect }: { service: Svc; height?: number; width?: number | `${number}%`; radius?: number; aspect?: number }) {
  const v = serviceVisual(service);
  const box = { width: width ?? ("100%" as const), ...(height ? { height } : {}), ...(aspect ? { aspectRatio: aspect } : {}), borderRadius: radius, overflow: "hidden" as const };
  if (service.imageUrl) {
    return (
      <View style={box}>
        <FadeImage source={{ uri: service.imageUrl }} resizeMode="cover" style={{ width: "100%", height: "100%" }} />
      </View>
    );
  }
  if (v.bottle) {
    return (
      <View style={[box, { backgroundColor: v.bottle.tint, alignItems: "center", justifyContent: "center" }]}>
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
