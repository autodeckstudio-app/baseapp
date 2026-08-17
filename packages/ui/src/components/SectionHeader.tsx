import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.sm,
      }}
    >
      <Text style={{ ...typography.title, color: colors.textPrimary }}>{title}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity onPress={onAction} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ ...typography.captionMedium, color: colors.accent }}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
