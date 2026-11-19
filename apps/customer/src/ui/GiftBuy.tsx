// The buy panel: what the gift is, the price (from the server), and the terms, all above the pay button.
import {View} from "react-native";
import { GIFT_TERMS, GIFT_VALID_DAYS } from "@autodeck/core";
import { Button, Pane, Row, T, rupees } from "./kit";

export function GiftBuy({ amountPaise, canPay, busy, onPay,serviceName="Foam wash" }: { amountPaise: number; canPay: boolean; busy: boolean; onPay: () => void;serviceName?:string|undefined }) {
  return (
    <Pane pad="inset"><View style={{gap:18}}>
<T role="label" tone="tertiary">GIFT A SERVICE</T>
      <T role="heading">Buy a gift</T>
      <Row title={serviceName} detail="Any car, one use" />
      <View style={{paddingVertical:8,gap:5}}><T role="caption" tone="tertiary">Gift value</T><T role="title">{rupees(amountPaise)}</T></View>
      <Row title="Valid for" detail={`${GIFT_VALID_DAYS} days from purchase`} last />
      <T role="caption" tone="secondary">{GIFT_TERMS.validity}</T>
      <T role="caption" tone="secondary">{GIFT_TERMS.nonRefundable}</T>
      {canPay
        ? <Button label={`Pay ${rupees(amountPaise)}`} busy={busy} onPress={onPay} />
        : <T role="caption" tone="tertiary">Buying a gift works in the browser at app.autodeck.in.</T>}
    </View></Pane>
  );
}
