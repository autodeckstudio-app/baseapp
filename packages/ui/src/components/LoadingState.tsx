import { View, Text, ActivityIndicator } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";

export interface LoadingStateProps {
  label?: string;
  /** Fill the parent (use inside a screen root); false for inline use. */
  fill?: boolean;
}

export function LoadingState({ label, fill = true }: LoadingStateProps) {
  return (
    <View
      style={{
        flex: fill ? 1 : undefined,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
      }}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      {label && (
        <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.md }}>{label}</Text>
      )}
    </View>
  );
}
