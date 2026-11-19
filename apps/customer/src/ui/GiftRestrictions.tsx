// Compact gift restrictions for the buy card and the code card: subtle red text,
// no capsules. Informational only, not buttons. The full sentence stays in core
// (GIFT_TERMS.nonRefundable) for the redeem screen and the share message.
import { View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { T } from "./kit";

export function GiftRestrictions() {
  const { colors, name } = useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={{ paddingTop: 2 }}><NavIcon name="close" size={16} color={colors.danger} cut={name === "light" ? "#FFFFFF" : "#252C35"} /></View>
      <View style={{ flex: 1 }}>
        <T role="caption" tone="danger">Non-refundable · No cash exchange · Non-transferable</T>
      </View>
    </View>
  );
}
