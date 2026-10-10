// Native glass pane: the one raised material.
//
// iOS: real backdrop blur (expo-blur) under a translucent tint, a hairline
// edge and a lit top edge. Android and "reduce transparency": the solid
// fallback fill, same edge and sheen (spec §3.5: static fallback on
// Android - blur is costly on low-end devices). Glass never sits on glass:
// don't nest <Glass> inside <Glass>.
import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { glassFill, radius as radii, space } from "../theme/index.js";
import { useExperienceTheme } from "./ThemeContext.js";

export type GlassTone = "accent" | "premium" | "danger" | "warning";

export interface GlassProps {
  children?: ReactNode;
  pad?: keyof typeof space | "none";
  round?: keyof typeof radii;
  /** A state's hue on the edge only, when the state is the pane's subject. */
  tone?: GlassTone;
  /** Warm fill for the one active/working pane; cool for premium. */
  fill?: "base" | "warm" | "cool";
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener?.("reduceTransparencyChanged", setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}

export function Glass({ children, pad = "gap", round = "card", tone, fill = "base", style, testID }: GlassProps) {
  const { name, colors, glass } = useExperienceTheme();
  const reduce = useReduceTransparency();
  const blur = Platform.OS === "ios" && !reduce;
  const edge = tone ? colors[tone] : glass.edge;
  const tint = fill === "warm" ? colors.accentHaze : fill === "cool" ? colors.premiumHaze : undefined;

  const frame: ViewStyle = {
    borderRadius: radii[round],
    borderWidth: 1,
    borderColor: edge,
    borderTopColor: tone ? edge : glass.sheen,
    overflow: "hidden",
    backgroundColor: blur ? "transparent" : glass.fallbackFill,
    // Web (the PWA): real gradient glass with backdrop blur and a lit edge, only on the dark theme.
    ...(Platform.OS === "web" && name === "night" && !reduce
      ? ({
          backgroundColor: "transparent",
          backgroundImage: glassFill(glass, fill === "warm" ? "warm" : fill === "cool" ? "cool" : "base"),
          backdropFilter: `blur(${glass.blur}px) saturate(${glass.saturate})`,
          WebkitBackdropFilter: `blur(${glass.blur}px) saturate(${glass.saturate})`,
          boxShadow: "0 24px 60px -18px rgba(0,0,0,.65), 0 2px 10px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.22), inset 0 -1px 0 rgba(255,255,255,.04)",
        } as object)
      : {}),
  };
  const inner: ViewStyle = { padding: pad === "none" ? 0 : space[pad] };

  return (
    <View style={[frame, style]} testID={testID}>
      {blur ? (
        <BlurView
          intensity={glass.nativeIntensity}
          tint={glass.nativeTint}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />
      ) : null}
      {tint ? (
        <View style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: tint }} />
      ) : null}
      <View style={inner}>{children}</View>
    </View>
  );
}
