import { View, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../tokens/colors.js";
import { spacing } from "../tokens/spacing.js";

export interface DividerProps {
  spacingY?: keyof typeof spacing;
  style?: StyleProp<ViewStyle>;
}

export function Divider({ spacingY, style }: DividerProps) {
  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: colors.divider,
          marginVertical: spacingY ? spacing[spacingY] : 0,
        },
        style,
      ]}
    />
  );
}
