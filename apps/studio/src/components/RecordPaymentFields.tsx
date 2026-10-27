import { Text, View } from "react-native";
import { colors, spacing, Button, TextInput } from "@autodeck/ui";
import { recordAmountLine, WRONG_AMOUNT_NOTE, type RecordMethod } from "../lib/record-payment-rules";
import { UpiQr } from "./UpiQr";

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
      {upi ? <UpiQr /> : null}
      {upi ? <Text style={{ color: colors.textMuted }}>The customer scans and pays. Tap Confirm once the customer says they paid - the office checks the account and marks it paid.</Text> : null}
      {!upi ? <Button label={verified ? "Cash in hand" : "I have the cash"} size="md" fullWidth={false} variant={verified ? "primary" : "secondary"} onPress={() => onVerified(!verified)} /> : null}
    </View>
  );
}
