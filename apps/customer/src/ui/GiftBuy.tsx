// The buy panel: what the gift is, the price (from the server), and the terms, all above the pay button.
import { GIFT_TERMS, GIFT_VALID_DAYS } from "@autodeck/core";
import { Button, Pane, Row, T, rupees } from "./kit";

export function GiftBuy({ amountPaise, canPay, busy, onPay }: { amountPaise: number; canPay: boolean; busy: boolean; onPay: () => void }) {
  return (
    <Pane pad="gap">
      <T role="heading">Buy a gift</T>
      <Row title="Foam wash" detail="Any car, one use" />
      <Row title="Price" detail={rupees(amountPaise)} />
      <Row title="Valid for" detail={`${GIFT_VALID_DAYS} days from purchase`} last />
      <T role="caption" tone="secondary">{GIFT_TERMS.validity}</T>
      <T role="caption" tone="secondary">{GIFT_TERMS.nonRefundable}</T>
      {canPay
        ? <Button label={`Pay ${rupees(amountPaise)} and get the gift code`} busy={busy} onPress={onPay} />
        : <T role="caption" tone="tertiary">Buying a gift works in the browser at app.autodeck.in.</T>}
    </Pane>
  );
}
