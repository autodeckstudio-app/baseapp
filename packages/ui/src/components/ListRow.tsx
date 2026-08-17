import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";

export interface ListRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
}

/** A single label/value row — for settings lists, price breakdowns, key/value details. */
export function ListRow({ label, value, onPress, showChevron = false, destructive = false }: ListRowProps) {
  const content = (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingVertical: spacing.sm + 2,
        minHeight: 44,
      }}
    >
      <Text style={{ ...typography.body, color: destructive ? colors.error : colors.textSecondary }}>{label}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {value !== undefined && (
          <Text style={{ ...typography.bodyMedium, color: destructive ? colors.error : colors.textPrimary }}>
            {value}
          </Text>
        )}
        {showChevron && <Text style={{ color: colors.textMuted, fontSize: 16 }}>›</Text>}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }
  return content;
}
