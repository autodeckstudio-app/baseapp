import { View, Text, TextInput as RNTextInput, TouchableOpacity } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";

export interface SearchInputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Pill-shaped search field with a clear button once text is entered. */
export function SearchInput({ value, onChangeText, placeholder = "Search", autoFocus }: SearchInputProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceSunken,
        borderRadius: radius.full,
        paddingHorizontal: spacing.md,
        height: 44,
      }}
    >
      <Text style={{ color: colors.textMuted, marginRight: spacing.xs, fontSize: 16 }}>⌕</Text>
      <RNTextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        accessibilityLabel={placeholder}
        style={{ flex: 1, fontSize: typography.body.fontSize, color: colors.textPrimary, paddingVertical: 0 }}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText("")}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={{ color: colors.textMuted, fontSize: 16 }}>×</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
