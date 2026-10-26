import { Text, View } from "react-native";
import { colors, spacing, Button, TextInput } from "@autodeck/ui";
import { recordAmountLine, WRONG_AMOUNT_NOTE, type RecordMethod } from "../lib/record-payment-rules";

/** Cash/UPI choice, exact amount line and the receipt check shown inside the Record payment confirm. Behind UPI_RECORD_ENABLED. */
export function RecordPaymentFields({ totalPaise, method, onMethod, verified, onVerified, reference, onReference }: { totalPaise: number; method: RecordMethod; onMethod: (m: RecordMethod) => void; verified: boolean; onVerified: (v: boolean) => void; reference: string; onReference: (v: string) => void }) {
  const upi = method === "upi_manual";
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <Button label="Cash" size="md" fullWidth={false} variant={method === "cash" ? "primary" : "secondary"} onPress={() => { onMethod("cash"); onVerified(false); }} />
        <Button label="UPI" size="md" fullWidth={false} variant={upi ? "primary" : "secondary"} onPress={() => { onMethod("upi_manual"); onVerified(false); }} />
      </View>
      <Text style={{ color: colors.textPrimary }}>{recordAmountLine(totalPaise)}</Text>
      <Text style={{ color: colors.textMuted }}>{WRONG_AMOUNT_NOTE}</Text>
      {upi ? <TextInput label="UPI reference" value={reference} onChangeText={onReference} autoCapitalize="characters" /> : null}
      <Button label={verified ? (upi ? "Payment seen in the account" : "Cash in hand") : (upi ? "I checked the payment arrived" : "I have the cash")} size="md" fullWidth={false} variant={verified ? "primary" : "secondary"} onPress={() => onVerified(!verified)} />
    </View>
  );
}
