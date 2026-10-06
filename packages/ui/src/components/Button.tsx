import { ActivityIndicator, Platform, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
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

/** Primary action control. Use `variant="primary"` sparingly - one per screen. */
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

  const web = Platform.OS === "web";
  const raised = (variant === "primary" || variant === "secondary") && !isDisabled;
  const webLook = (pressed: boolean): Record<string, unknown> => {
    if (!web) return {};
    if (variant === "primary") {
      return {
        backgroundImage: "linear-gradient(180deg, #F59A4E 0%, #EC8638 52%, #DC7428 100%)",
        boxShadow: raised && !pressed ? "0 8px 18px rgba(236,134,56,0.38), inset 0 1px 0 rgba(255,255,255,0.45), inset 0 -2px 0 rgba(160,70,10,0.28)" : "0 3px 8px rgba(236,134,56,0.3), inset 0 1px 0 rgba(255,255,255,0.35)",
      };
    }
    if (variant === "secondary") {
      return { backdropFilter: "blur(18px) saturate(150%)", WebkitBackdropFilter: "blur(18px) saturate(150%)", backgroundColor: "rgba(255,255,255,0.78)", border: "1px solid rgba(255,255,255,0.95)", boxShadow: pressed ? "0 1px 3px rgba(40,30,60,0.12)" : "4px 6px 14px rgba(40,30,60,0.12), -1px -1px 3px rgba(255,255,255,0.9)" };
    }
    return {};
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: variant === "secondary" ? "#FFFFFF" : v.bg,
          borderRadius: variant === "primary" || variant === "secondary" ? 999 : radius.md,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: isDisabled ? 0.45 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          minHeight: 44, // touch target
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          transform: pressed && !isDisabled ? [{ translateY: 2 }] : [],
        },
        webLook(pressed) as ViewStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <Text style={{ color: v.text, fontSize: s.fontSize, fontWeight: "600" }}>{label}</Text>
      )}
    </Pressable>
  );
}
