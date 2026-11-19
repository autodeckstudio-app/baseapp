// Compact gift restrictions for the buy card and the code card. Same meaning as
// GIFT_TERMS.nonRefundable; the full sentence stays in core for the redeem screen
// and the share message.
import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { Chip, T } from "./kit";

export function GiftRestrictions() {
  const { colors, name } = useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ paddingTop: 2 }}><NavIcon name="close" size={16} color={colors.textTertiary} cut={name === "light" ? "#FFFFFF" : "#252C35"} /></View>
      <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <T tone="secondary">After payment:</T>
        <Chip small label="Non-refundable" />
        <Chip small label="No cash exchange" />
        <Chip small label="Non-transferable" />
      </View>
    </View>
  );
}
