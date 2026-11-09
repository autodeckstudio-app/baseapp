import { useEffect } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Button, T, rupees } from "./kit";
import { advanceDisclosureLines } from "../lib/advance-booking";

/** Pay-at-studio advance offer, shown BEFORE the booking is created.
 *  Presentation follows the collected design reference (Gauri mockup 8 Nov
 *  2026, wamid.HBgMOTE4OTc1MTI4ODE2FQIAEhgWM0VCMDFBNzNGNkZGQkM5RERGNEVGOQA=,
 *  "add it list" - design reference only): a bottom sheet with the service
 *  total, the 20% advance, the studio balance, a Pay [actual advance amount]
 *  action and a Go back action. Money rules are owner-adopted (2 Nov 2026):
 *  the advance is 20% of the discounted service price including GST excluding
 *  pickup/drop, rounded up to the whole rupee; the balance is the exact
 *  remainder (packages/core/src/advance-split.ts). The no-show rule is
 *  disclosed before payment, as adopted. Rendered only when the caller's
 *  advance flow is enabled - ADVANCE_SPLIT_ENABLED stays OFF in this branch. */
export type AdvancePaymentSheetProps = {
  visible: boolean;
  serviceName?: string;
  visitLabel?: string;
  /** Discounted service price including GST, excluding pickup/drop (paise). */
  serviceTotalPaise: number;
  /** 20% advance, rounded up (paise). */
  advancePaise: number;
  /** Exact remainder of the service total (paise). */
  balancePaise: number;
  /** When true, note that pickup/drop charges come on top at the studio. */
  pickupFees: boolean;
  busy: boolean;
  onPayAdvance: () => void;
  onGoBack: () => void;
};

function SheetMoneyRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  const { colors } = useExperienceTheme();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 10, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.borderSubtle }}>
      <T tone="secondary">{label}</T>
      <T role="bodyStrong">{value}</T>
    </View>
  );
}

export function AdvancePaymentSheet(p: AdvancePaymentSheetProps) {
  const { colors, name } = useExperienceTheme();
  const d = advanceDisclosureLines();
  useEffect(() => {
    const doc = (globalThis as { document?: { addEventListener: (t: string, l: (e: { key?: string }) => void) => void; removeEventListener: (t: string, l: (e: { key?: string }) => void) => void } }).document;
    if (!p.visible || !doc) return;
    const close = (event: { key?: string }) => { if (event.key === "Escape") p.onGoBack(); };
    doc.addEventListener("keydown", close);
    return () => doc.removeEventListener("keydown", close);
  }, [p.visible, p.onGoBack]);
  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onGoBack}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: colors.scrim }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={p.onGoBack} style={{ flex: 1 }} />
        <ScrollView accessibilityViewIsModal style={{maxHeight: "90%", flexGrow: 0}} contentContainerStyle={{ alignSelf: "center", width: "100%", maxWidth: 640, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: colors.borderSubtle, backgroundColor: name === "light" ? "#FAF9F6" : colors.surfaceElevated, padding: 24, paddingBottom: 36, gap: 18 }}>
          <T role="title">Reserve your preferred slot</T>
          {p.serviceName || p.visitLabel ? <View style={{ gap: 4 }}><T role="bodyStrong">{p.serviceName}</T>{p.visitLabel ? <T role="caption" tone="secondary">{p.visitLabel}</T> : null}</View> : null}
          <View>
            <SheetMoneyRow label="Service total" value={rupees(p.serviceTotalPaise)} />
            <SheetMoneyRow label="Booking advance (20%)" value={rupees(p.advancePaise)} />
            <SheetMoneyRow label="Service balance at studio" value={rupees(p.balancePaise)} last />
          </View>
          <View style={{ gap: 6 }}>
            <T role="caption" tone="secondary">{d.split}</T>
            <T role="caption" tone="secondary">{d.noShow}</T>
            {p.pickupFees ? <T role="caption" tone="secondary">Pickup and drop charges are added to what you pay at the studio.</T> : null}
          </View>
          <Button label={`Pay ${rupees(p.advancePaise)} advance`} busy={p.busy} disabled={p.busy} onPress={p.onPayAdvance} />
          <Button kind="quiet" label="Go back" onPress={p.onGoBack} />
          <T role="caption" tone="tertiary" style={{ textAlign: "center" }}>Secure payment via Razorpay</T>
        </ScrollView>
      </View>
    </Modal>
  );
}
