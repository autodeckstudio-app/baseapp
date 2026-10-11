import { View, Text, Platform } from "react-native";
import { isNightPalette as night, colors } from "@autodeck/ui";
import { floatHero } from "@autodeck/ui/theme";

// Photo backdrop behind the top of a screen, as on the Today screen.
export function CanvasBackdrop() {
  if (Platform.OS !== "web") return null;
  return <View pointerEvents="none" style={floatHero(night, colors.background) as never} />;
}

// Eyebrow plus a large heading that sits on the photo.
export function CanvasTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const web = Platform.OS === "web";
  return (
    <View style={{ minHeight: 170, justifyContent: "flex-end", marginBottom: 12 }}>
      {eyebrow ? (
        <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,.92)", textTransform: "uppercase", letterSpacing: 1.6, ...(web ? { textShadow: "0 1px 12px rgba(0,0,0,.5)" } : {}) } as never}>{eyebrow}</Text>
      ) : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 56, lineHeight: 60, fontWeight: "500", letterSpacing: -2.4, color: "rgba(255,255,255,.95)", ...(web ? { textShadow: "0 6px 40px rgba(0,0,0,.4)" } : {}) } as never}>{title}</Text>
    </View>
  );
}
