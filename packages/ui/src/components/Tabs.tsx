import { View, Text, TouchableOpacity } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";
import { radius } from "../tokens/radius.js";
import { typography } from "../tokens/typography.js";

export interface TabItem {
  key: string;
  label: string;
}

export interface TabsProps {
  items: TabItem[];
  selectedKey: string;
  onSelect: (key: string) => void;
}

/** In-page segmented control — for filtering/switching views within a
 * screen. Not a replacement for the app's tab-bar navigation. */
export function Tabs({ items, selectedKey, onSelect }: TabsProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceSunken,
        borderRadius: radius.md,
        padding: spacing.xxs,
      }}
    >
      {items.map((item) => {
        const selected = item.key === selectedKey;
        return (
          <TouchableOpacity
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item.key)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm,
              alignItems: "center",
              backgroundColor: selected ? colors.surface : "transparent",
              ...(selected ? { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } } : {}),
            }}
          >
            <Text
              style={{
                ...typography.captionMedium,
                color: selected ? colors.textPrimary : colors.textMuted,
              }}
            >
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
