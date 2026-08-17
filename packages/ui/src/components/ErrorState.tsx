import { View, Text } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";
import { Button } from "./Button.js";

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  fill?: boolean;
}

export function ErrorState({ title = "Something went wrong", message, onRetry, fill = true }: ErrorStateProps) {
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
            marginBottom: spacing.lg,
          }}
        >
          {message}
        </Text>
      )}
      {onRetry && <Button label="Retry" onPress={onRetry} variant="secondary" size="md" fullWidth={false} />}
    </View>
  );
}
