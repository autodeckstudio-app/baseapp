import { View, Text, Platform } from "react-native";

// The photo now lives on the tab scene itself (full height), so pages no longer draw their own backdrop.
export function CanvasBackdrop() {
  return null;
}

// Eyebrow plus a large heading that sits on the photo.
export function CanvasTitle({ eyebrow, title }: { eyebrow?: string; title: string }) {
  const web = Platform.OS === "web";
  return (
    <View style={{ minHeight: 140, justifyContent: "flex-end", marginBottom: 8 }}>
      {eyebrow ? (
        <Text style={{ fontSize: 13, fontWeight: "600", color: "rgba(255,255,255,.92)", textTransform: "uppercase", letterSpacing: 1.6, ...(web ? { textShadow: "0 1px 12px rgba(0,0,0,.5)" } : {}) } as never}>{eyebrow}</Text>
      ) : null}
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 56, lineHeight: 60, fontWeight: "500", letterSpacing: -2.4, color: "rgba(255,255,255,.95)", ...(web ? { textShadow: "0 6px 40px rgba(0,0,0,.4)" } : {}) } as never}>{title}</Text>
    </View>
  );
}
