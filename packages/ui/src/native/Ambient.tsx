// The ambient field behind a screen: dark canvas lit by soft amber and
// champagne light. Atmosphere, never information, and it must stay cheap.
// iOS: three light discs softened by a full-strength blur. Android: the
// plain canvas (spec §3.5 static fallback; large blurs are costly there).
// Glass panes sit on top of it.
import type { ReactNode } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { ambient } from "../theme/index.js";
import { useExperienceTheme } from "./ThemeContext.js";

const FILL = { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } as const;

export function Ambient({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { name, colors } = useExperienceTheme();
  const lit = Platform.OS === "ios";
  return (
    <View style={[{ flex: 1, backgroundColor: colors.canvas, overflow: "hidden" }, style]}>
      {lit ? (
        <View pointerEvents="none" style={FILL}>
          {ambient[name].map((l, i) => (
            <View
              key={i}
              style={{
                position: "absolute",
                left: `${l.x - l.size / 2}%`,
                top: `${l.y - l.size / 2}%`,
                width: `${l.size}%`,
                aspectRatio: 1,
                borderRadius: 9999,
                backgroundColor: l.color,
                opacity: l.opacity * 1.6,
              }}
            />
          ))}
          <BlurView intensity={100} tint={name} style={FILL} />
        </View>
      ) : null}
      {children}
    </View>
  );
}
