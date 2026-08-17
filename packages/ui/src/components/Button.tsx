import { ActivityIndicator, Text, TouchableOpacity, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "md" | "lg";

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_STYLES: Record<ButtonVariant, { bg: string; bgPressed: string; text: string; border?: string }> = {
  primary: { bg: colors.accent, bgPressed: colors.accentPressed, text: colors.textOnAccent },
  secondary: { bg: colors.surfaceSunken, bgPressed: colors.border, text: colors.textPrimary },
  ghost: { bg: "transparent", bgPressed: colors.surfaceSunken, text: colors.textPrimary, border: colors.border },
  destructive: { bg: "transparent", bgPressed: colors.errorMuted, text: colors.error, border: colors.error },
};

const SIZE_STYLES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  md: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, fontSize: typography.body.fontSize },
  lg: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl, fontSize: typography.title.fontSize },
};

/** Primary action control. Use `variant="primary"` sparingly — one per screen. */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        {
          backgroundColor: v.bg,
          borderRadius: radius.md,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: isDisabled ? 0.5 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          minHeight: 44, // touch target
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={{ color: v.text, fontSize: s.fontSize, fontWeight: "600" }}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
