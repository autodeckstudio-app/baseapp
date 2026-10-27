import { Text, View } from "react-native";
import { colors, spacing, Button, TextInput } from "@autodeck/ui";
import { recordAmountLine, WRONG_AMOUNT_NOTE, type CollectMethod } from "../lib/record-payment-rules";
import { UpiQr } from "./UpiQr";

const METHODS: { value: CollectMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "upi_manual", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer" },
];

/** Walk-in membership collection: method choice, exact amount, QR for UPI, and the same receipt guard as the job Record payment step (money seen first, reference for account arrivals, mismatches go to the office). */
export function MembershipPaymentFields({ amountPaise, method, onMethod, verified, onVerified, reference, onReference }: { amountPaise: number | null; method: CollectMethod; onMethod: (m: CollectMethod) => void; verified: boolean; onVerified: (v: boolean) => void; reference: string; onReference: (v: string) => void }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ color: colors.textMuted, textTransform: "uppercase", letterSpacing: 1, fontSize: 12 }}>Paid via</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
        {METHODS.map((m) => (
          <Button key={m.value} label={m.label} size="md" fullWidth={false} variant={method === m.value ? "primary" : "secondary"} onPress={() => { onMethod(m.value); onVerified(false); }} />
        ))}
      </View>
      {amountPaise !== null ? <Text style={{ color: colors.textPrimary }}>{recordAmountLine(amountPaise)}</Text> : null}
      <Text style={{ color: colors.textMuted }}>{WRONG_AMOUNT_NOTE}</Text>
      {method === "upi_manual" ? <UpiQr /> : null}
      {method === "upi_manual" ? <Text style={{ color: colors.textMuted, textAlign: "center" }}>Showing this code does not mean the payment arrived. Check the account, then confirm below.</Text> : null}
      <TextInput label={method === "cash" ? "Reference / note (optional)" : "Payment reference"} value={reference} onChangeText={onReference} autoCapitalize="characters" />
      <Button label={verified ? (method === "cash" ? "Cash in hand" : "Payment seen in the account") : (method === "cash" ? "I have the cash" : "I checked the payment arrived")} size="md" fullWidth={false} variant={verified ? "primary" : "secondary"} onPress={() => onVerified(!verified)} />
    </View>
  );
}
