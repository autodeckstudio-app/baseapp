import { View, Text } from "react-native";
import { colors, phoneFont } from "@autodeck/ui";

// The photo lives on the tab scene itself (veiled to the palette), so pages draw no backdrop of their own.
export function CanvasBackdrop() {
  return null;
}

// Eyebrow plus a large heading, in the palette's own text colours so it reads in day and night.
export function CanvasTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <View style={{ minHeight: phoneFont(120, 84), justifyContent: "flex-end", marginBottom: 8 }}>
      {eyebrow ? (
        <Text style={{ fontSize: phoneFont(13, 12), fontWeight: "600", color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 1.6 }}>{eyebrow}</Text>
      ) : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: phoneFont(56, 36), lineHeight: phoneFont(60, 40), fontWeight: "500", letterSpacing: phoneFont(-2.4, -1.4), color: colors.textPrimary }}>{title}</Text>
    </View>
  );
}
