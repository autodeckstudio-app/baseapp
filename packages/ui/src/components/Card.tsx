import { Platform, View, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { elevation } from "../tokens/elevation.js";

export interface CardProps {
  children: React.ReactNode;
  onPress?: (() => void) | undefined;
  padding?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
  /** Flat cards sit on a surface without their own shadow (e.g. inside a modal). */
  flat?: boolean;
}

/** Base surface for grouped content - the foundation for the domain cards below. */
export function Card({ children, onPress, padding = "lg", style, flat = false }: CardProps) {
  const base: ViewStyle = {
    backgroundColor: "rgba(255,255,255,0.82)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.94)",
    ...(Platform.OS === "web" ? ({backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)"} as ViewStyle) : {}),
    borderRadius: radius.lg,
    padding: spacing[padding],
    ...(flat ? { borderWidth: 1, borderColor: colors.border } : elevation.card),
  };

  if (onPress) {
    return (
      <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.85} style={[base, style]}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={[base, style]}>{children}</View>;
}
