import { createElement } from "react";
import { Platform, Text, TextInput, View } from "react-native";
import { colors, spacing, typography } from "@autodeck/ui";

/** Date and time field for agreed pickup/drop times. India time. Uses the native picker on web and tablets, plain text elsewhere. */
export function AgreedTimeInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flex: 1, minWidth: 200, gap: 4 }}>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label} (India time)</Text>
      {Platform.OS === "web"
        ? createElement("input", {
            type: "datetime-local",
            value: value.replace(" ", "T"),
            step: 300,
            onChange: (e: { target: { value: string } }) => onChange(e.target.value),
            "aria-label": `${label}, India time`,
            style: { height: 44, minWidth: 0, width: "100%", boxSizing: "border-box", fontSize: 16, padding: "0 12px", borderRadius: 14, border: `1px solid ${colors.border}`, background: colors.surfaceSunken, color: colors.textPrimary },
          })
        : <TextInput value={value} onChangeText={onChange} placeholder="2026-10-12 16:30" placeholderTextColor={colors.textMuted} style={{ ...typography.caption, color: colors.textPrimary, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: spacing.sm, height: 44 }} />}
    </View>
  );
}
