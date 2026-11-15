import { catalogueAsset } from "../lib/catalogue-assets";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  View,
  type ImageSourcePropType,
} from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import type { IconName } from "@autodeck/ui/theme";
import { serviceVisual, hasGaragePhoto } from "../lib/imagery";
import { T } from "./kit";
type Svc = {
  id?: string;
  name: string;
  brand?: string | null;
  category: string;
  imageUrl?: string | null;
};
export function garageIconFor(name: string): IconName {
  const n = name.toLowerCase();
  if (n.includes("alignment") || n.includes("tyre") || n.includes("wheel"))
    return "car";
  if (n.includes("ac ")) return "tools";
  if (n.includes("battery")) return "check";
  if (n.includes("repair")) return "wrench";
  return "search";
}
/** Same approved image at a delivery size that fits the component. A failed product photo never becomes an unrelated bottle. */
export function ServicePhoto({
  service,
  height,
  width,
  radius = 0,
  aspect,
  variant = 0,
}: {
  service: Svc;
  height?: number;
  width?: number | `${number}%`;
  radius?: number;
  aspect?: number;
  variant?: number;
}) {
  const { colors } = useExperienceTheme();
  const v = serviceVisual(service, variant),
    mapped = catalogueAsset(service);
  const small = height !== undefined && height <= 180;
  const source: ImageSourcePropType | undefined = mapped
    ? small
      ? (mapped.thumbnail ?? mapped.source)
      : mapped.source
    : service.imageUrl
      ? { uri: service.imageUrl }
      : v.bottle
        ? v.bottle.src
        : service.brand
          ? undefined
          : v.photo;
  const product = mapped?.product ?? !!v.bottle;
  const identity = `${service.id ?? service.name}:${small}:${service.imageUrl ?? ""}`;
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">(
    "loading",
  );
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    setStatus("loading");
    const timeout = setTimeout(
      () =>
        setStatus((current) => (current === "loading" ? "failed" : current)),
      15000,
    );
    return () => clearTimeout(timeout);
  }, [identity, retry]);
  const box = {
    width: width ?? ("100%" as const),
    ...(height ? { height } : {}),
    ...(aspect ? { aspectRatio: aspect } : {}),
    borderRadius: radius,
    overflow: "hidden" as const,
    minWidth: 0,
  };
  if (
    !mapped &&
    !service.imageUrl &&
    ((/fabric|upholstery/i.test(service.name) && !v.bottle) ||
      (service.category === "garage" && !hasGaragePhoto(service.name)))
  )
    return (
      <View
        style={[
          box,
          {
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        <Icon
          name={garageIconFor(` ${service.name} `)}
          color={colors.textSecondary}
          size={40}
        />
      </View>
    );
  return (
    <View
      style={[box, { backgroundColor: product ? "#FFFFFF" : colors.surface }]}
    >
      {source && status !== "failed" ? (
        <Image
          key={`${identity}:${retry}`}
          accessibilityLabel={service.name}
          source={source}
          resizeMode={product ? "contain" : "cover"}
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("failed")}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      ) : null}
      {status === "loading" && source ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 8,
            alignItems: "center",
          }}
        >
          <ActivityIndicator
            size="small"
            color={product ? "#544936" : colors.textSecondary}
          />
        </View>
      ) : null}
      {!source || status === "failed" ? (
        <View
          style={{
            flex: 1,
            padding: 8,
            justifyContent: "center",
            alignItems: "center",
            gap: 6,
          }}
        >
          <T
            role="caption"
            tone="secondary"
            style={{
              textAlign: "center",
              fontSize: 11,
              color: product ? "#4B4741" : colors.textSecondary,
            }}
          >
            {product || service.brand
              ? "Product image unavailable"
              : "Image unavailable"}
          </T>
          {source ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Retry image for ${service.name}`}
              onPress={() => setRetry((n) => n + 1)}
              style={{ padding: 8 }}
            >
              <T
                role="caption"
                style={{ color: product ? "#4B4741" : colors.textPrimary }}
              >
                Retry
              </T>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
