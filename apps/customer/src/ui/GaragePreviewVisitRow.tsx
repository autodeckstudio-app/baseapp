import React from "react";
import { View } from "react-native";
import { T, Chip } from "./kit";
import { useExperienceTheme } from "@autodeck/ui/native";
export function GaragePreviewVisitRow({
  at,
  title,
  status,
  first,
}: {
  at: string;
  title: string;
  status: string;
  first?: boolean;
}) {
  const { colors } = useExperienceTheme();
  return (
    <View
      style={{
        paddingVertical: 14,
        gap: 8,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.borderSubtle,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          gap: 10,
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <T style={{ fontSize: 14, flex: 1 }}>{title}</T>
        <T role="caption" tone="secondary">
          {new Date(at).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </T>
      </View>
      <View style={{ alignItems: "flex-start" }}>
        <Chip small label={status.replace(/_/g, " ")} tone="premium" />
      </View>
    </View>
  );
}
