import { View, Text } from "react-native";
import { colors } from "../tokens/colors.js";
import { radius } from "../tokens/radius.js";

export interface AvatarProps {
  name: string;
  size?: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** Initials-based avatar — no photo storage/dependency needed for V1. */
export function Avatar({ name, size = 40 }: AvatarProps) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.full,
        backgroundColor: colors.accentMuted,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.accentPressed, fontWeight: "700", fontSize: size * 0.4 }}>
        {initialsOf(name)}
      </Text>
    </View>
  );
}
