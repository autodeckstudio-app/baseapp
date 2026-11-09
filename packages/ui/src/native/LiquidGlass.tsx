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
import { material, reduceWebTransparency, radius as radii, space } from "../theme/index.js";
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

export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(()=>Platform.OS==="web"&&reduceWebTransparency());
  useEffect(() => {
    let alive = true, changed=false;
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => {if(alive&&!changed)setReduce(v||(Platform.OS==="web"&&reduceWebTransparency()))}).catch(()=>undefined);
    const sub = AccessibilityInfo.addEventListener?.("reduceTransparencyChanged", v=>{changed=true;if(alive)setReduce(v||(Platform.OS==="web"&&reduceWebTransparency()))});
    const media=(globalThis as unknown as{matchMedia?:(q:string)=>{addEventListener?:(e:string,cb:()=>void)=>void;removeEventListener?:(e:string,cb:()=>void)=>void}}).matchMedia?.("(prefers-reduced-transparency: reduce)");const update=()=>setReduce(reduceWebTransparency());if(Platform.OS==="web")media?.addEventListener?.("change",update);
    return () => {
      alive = false;
      sub?.remove();
      media?.removeEventListener?.("change",update);
    };
  }, []);
  return reduce;
}

export function LiquidGlass({ children, pad = "gap", round = "card", tone, fill = "base", style, testID }: GlassProps) {
  const { name, colors, glass } = useExperienceTheme();
  const reduce = useReduceTransparency();
  const blur = Platform.OS === "ios" && !reduce;
  const recipe=material(name,"surface",{reduce});
  const edge = tone ? colors[tone] : recipe.edge;
  const tint = fill === "warm" ? colors.accentHaze : fill === "cool" ? colors.premiumHaze : undefined;

  const frame: ViewStyle = {
    borderRadius: radii[round],
    borderWidth: 1,
    borderColor: edge,
    borderTopColor: tone ? edge : glass.sheen,
    overflow: "hidden",
    backgroundColor: blur ? "transparent" : recipe.fallback,
    // Web: the shared material in either mode, with a safe opaque fallback.
    ...(Platform.OS === "web" && !reduce
      ? ({
          backgroundImage: recipe.web.backgroundImage,
          backgroundColor: recipe.fill,
          backdropFilter: `blur(${glass.blur}px) saturate(${glass.saturate})`,
          WebkitBackdropFilter: `blur(${glass.blur}px) saturate(${glass.saturate})`,
          boxShadow: name === "light" ? "0 6px 18px rgba(44,58,80,.08), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(125,140,160,.10)" : "0 8px 22px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.24)",
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
