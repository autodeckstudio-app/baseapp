import { useState } from "react";
import {
  View,
  Platform,
  Text,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
} from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";

export interface TextInputProps extends Omit<RNTextInputProps, "style"> {
  label?: string;
  error?: string | null;
  helperText?: string;
}

/** Labelled text field with a focus state and inline error message. */
export function TextInput({ label, error, helperText, onFocus, onBlur, ...rest }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label && (
        <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs }}>
          {label}
        </Text>
      )}
      <RNTextInput
        placeholderTextColor={colors.textMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          borderWidth: 1.5,
          borderColor: hasError ? colors.error : focused ? colors.accent : "transparent",
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm + 4,
          fontSize: typography.body.fontSize,
          color: colors.textPrimary,
          backgroundColor: colors.surfaceSunken,
          minHeight: 44,
          ...(Platform.OS === "web" ? ({ boxShadow: "inset 2px 3px 6px rgba(40,30,60,0.10), inset -1px -1px 3px rgba(255,255,255,0.9)", outlineStyle: "none" } as object) : {}),
        }}
        accessibilityLabel={label}
        {...rest}
      />
      {hasError ? (
        <Text style={{ ...typography.caption, color: colors.error, marginTop: spacing.xs }}>{error}</Text>
      ) : helperText ? (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>{helperText}</Text>
      ) : null}
    </View>
  );
}
