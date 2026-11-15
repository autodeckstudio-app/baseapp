import { View, useWindowDimensions } from "react-native";
import { Button, T } from "./kit";
export function ServiceActionBar({
  car,
  price,
  hidePrice = false,
  label,
  disabled,
  onPress,
}: {
  car: string;
  price: string;
  hidePrice?: boolean;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { width } = useWindowDimensions();
  const stacked = width < 380;
  return (
    <View
      style={{
        width: "100%",
        flexDirection: stacked ? "column" : "row",
        alignItems: stacked ? "stretch" : "center",
        gap: stacked ? 10 : 12,
      }}
    >
      <View style={{ ...(stacked ? {} : { flex: 1 }), minWidth: 0 }}>
        <T role="caption" tone="tertiary" numberOfLines={1}>
          {car}
        </T>
        {hidePrice?null:<T role="heading" numberOfLines={1}>
          {price}
        </T>}
      </View>
      <Button
        label={label}
        disabled={disabled}
        onPress={onPress}
        style={{
          marginTop: 0,
          maxWidth: stacked ? "100%" : "68%",
          paddingHorizontal: 10,
        }}
      />
    </View>
  );
}
