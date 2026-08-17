import { Text, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../tokens/colors.js";
import { radius } from "../tokens/radius.js";

export interface IconButtonProps {
  /** A single glyph/symbol, e.g. "×", "‹", "⋯" — this system uses typographic
   * glyphs instead of an icon-font dependency. */
  glyph: string;
  onPress: () => void;
  accessibilityLabel: string;
  variant?: "default" | "filled";
  size?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Small tappable icon control — always at least a 44pt touch target. */
export function IconButton({
  glyph,
  onPress,
  accessibilityLabel,
  variant = "default",
  size = 40,
  disabled = false,
  style,
}: IconButtonProps) {
  const filled = variant === "filled";
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={[
        {
          width: Math.max(size, 44),
          height: Math.max(size, 44),
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: filled ? colors.surfaceSunken : "transparent",
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.5, color: colors.textPrimary, lineHeight: size * 0.55 }}>{glyph}</Text>
    </TouchableOpacity>
  );
}
