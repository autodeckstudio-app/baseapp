import{useExperienceTheme}from"../native/ThemeContext.js";
import{BlurView}from"expo-blur";
import{material}from"../theme/material.js";
import{useReduceTransparency}from"../native/LiquidGlass.js";
import { ActivityIndicator, Platform, Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type ButtonSize = "md" | "lg";

export interface ButtonProps {
  label: string;
  accessibilityLabel?:string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const SIZE_STYLES: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  md: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.lg, fontSize: typography.body.fontSize },
  lg: { paddingVertical: spacing.md + 2, paddingHorizontal: spacing.xl, fontSize: typography.title.fontSize },
};

/** Primary action control. Use `variant="primary"` sparingly - one per screen. */
export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = "primary",
  size = "lg",
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const s = SIZE_STYLES[size];
  const isDisabled = disabled || loading;

  const reduce=useReduceTransparency();
  const {name:mode}=useExperienceTheme();
  const web = Platform.OS === "web";
  const look=(pressed:boolean)=>material(mode,"control",{pressed,disabled:isDisabled,reduce});
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel??label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: Platform.OS==="ios"&&!reduce?"transparent":look(pressed).fallback,
          overflow:"hidden",
          borderRadius: 999,
          paddingVertical: s.paddingVertical,
          paddingHorizontal: s.paddingHorizontal,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: isDisabled ? 0.64 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          minHeight: 44, // touch target
          borderWidth: 1,
          borderColor: variant === "destructive" ? colors.error : look(pressed).edge,
          transform: pressed && !isDisabled ? [{ translateY: 2 }] : [],
        },
        web ? look(pressed).web as ViewStyle : {},
        variant === "primary" ? {borderColor:mode==="light"?"rgba(194,84,10,.45)":"rgba(236,134,56,.55)"}:variant==="destructive"?{borderColor:colors.error}:{},
        style,
      ]}
    >
      {Platform.OS==="ios"&&!reduce?<BlurView pointerEvents="none" intensity={55} tint={mode==="light"?"light":"dark"} style={{position:"absolute",top:0,right:0,bottom:0,left:0}}/>:null}
      {loading ? (
        <ActivityIndicator color={variant === "destructive" ? colors.error : look(false).ink} />
      ) : (
        <Text numberOfLines={1} style={{ textAlign:"center",flexShrink:1,color: variant === "destructive" ? colors.error : look(false).ink, fontSize: s.fontSize, fontWeight: "600" }}>{label}</Text>
      )}
    </Pressable>
  );
}
