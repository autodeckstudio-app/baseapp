import { View, Text } from "react-native";
import type { Vehicle } from "@autodeck/core";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { typography } from "../tokens/typography.js";
import { Card } from "./Card.js";

export interface VehicleCardProps {
  vehicle: Vehicle;
  onPress?: () => void;
}

export function VehicleCard({ vehicle, onPress }: VehicleCardProps) {
  return (
    <Card onPress={onPress}>
      <Text style={{ ...typography.title, color: colors.textPrimary, letterSpacing: 0.5 }}>
        {vehicle.registrationNumber}
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginTop: spacing.xxs }}>
        {vehicle.year} {vehicle.make} {vehicle.model} · {vehicle.color}
      </Text>
      {vehicle.category && (
        <View style={{ marginTop: spacing.sm }}>
          <Text style={{ ...typography.caption, color: colors.textMuted, textTransform: "capitalize" }}>
            {vehicle.category}
          </Text>
        </View>
      )}
    </Card>
  );
}
