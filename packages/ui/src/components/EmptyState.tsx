import { View, Text } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";
import { Button } from "./Button.js";

export interface EmptyStateProps {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  fill?: boolean;
}

export function EmptyState({ title, message, actionLabel, onAction, fill = true }: EmptyStateProps) {
  return (
    <View
      style={{
        flex: fill ? 1 : undefined,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing.xl,
      }}
    >
      <Text style={{ ...typography.title, color: colors.textPrimary, marginBottom: spacing.xs, textAlign: "center" }}>
        {title}
      </Text>
      {message && (
        <Text
          style={{
            ...typography.caption,
            color: colors.textMuted,
            textAlign: "center",
            marginBottom: actionLabel ? spacing.lg : 0,
          }}
        >
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button label={actionLabel} onPress={onAction} variant="primary" size="md" fullWidth={false} />
      )}
    </View>
  );
}
