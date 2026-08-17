import { View, Text } from "react-native";
import type { Service } from "@autodeck/core";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";
import { Card } from "./Card.js";
import { formatPaise } from "../format.js";

export interface ServiceCardProps {
  service: Service;
  onPress?: () => void;
}

export function ServiceCard({ service, onPress }: ServiceCardProps) {
  return (
    <Card onPress={onPress}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.sm }}>
        <Text style={{ ...typography.title, color: colors.textPrimary, flex: 1 }}>{service.name}</Text>
        <Text style={{ ...typography.priceSmall, color: colors.accent }}>from {formatPaise(service.basePrice)}</Text>
      </View>
      <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs, textTransform: "capitalize" }}>
        {service.category}
        {service.brand ? ` · ${service.brand}` : ""}
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.sm }} numberOfLines={2}>
        {service.description}
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm }}>
        <Text style={{ ...typography.caption, color: colors.textMuted }}>~{service.estimatedDurationMinutes} min</Text>
        {service.warrantyLabel && (
          <Text style={{ ...typography.caption, color: colors.success }}>{service.warrantyLabel}</Text>
        )}
      </View>
    </Card>
  );
}
