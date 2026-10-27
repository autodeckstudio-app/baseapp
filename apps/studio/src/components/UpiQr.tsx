import { Image, Text, View } from "react-native";
import { colors, spacing } from "@autodeck/ui";
import { UPI_PAYEE_LINE } from "../lib/record-payment-rules";

/** The merchant QR, rendered as a clean app asset from the owner-verified standee payload (byte-identical, verified by decoding the asset at full size and at 200px display size). Staff show it to a customer paying by UPI, then confirm arrival and note the reference. */
export function UpiQr() {
  return (
    <View style={{ gap: spacing.xs, alignItems: "center" }}>
      <View style={{ backgroundColor: "#ffffff", borderRadius: 16, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", padding: spacing.sm }}>
        <Image source={require("../../assets/brand/upi-qr.png")} style={{ width: 200, height: 200 }} accessibilityLabel="AutoDeck UPI payment code" />
      </View>
      <Text style={{ color: colors.textMuted, textAlign: "center" }}>{UPI_PAYEE_LINE}</Text>
    </View>
  );
}
