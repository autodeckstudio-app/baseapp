// The buy panel: what the gift is, the price (from the server), and the terms, all above the pay button.
import {View} from "react-native";
import { GIFT_VALID_DAYS } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { NavIcon } from "./NavIcon";
import { GiftRestrictions } from "./GiftRestrictions";
import { Button, InfoLine, Pane, Row, T, rupees } from "./kit";

export function GiftBuy({ amountPaise, canPay, busy, disabled, onPay,serviceName="Foam wash" }: { amountPaise: number; canPay: boolean; busy: boolean; disabled?:boolean; onPay: () => void;serviceName?:string|undefined }) {
  const { colors, name } = useExperienceTheme();
  const tileBg = name === "light" ? "#E8EDF4" : "#253447";
  return (
    <Pane pad="inset"><View style={{gap:16}}>
      <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
        <View style={{width:40,height:40,borderRadius:14,backgroundColor:tileBg,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:colors.borderSubtle}}><NavIcon name="gift" size={20} color={colors.textPrimary} cut={tileBg}/></View>
        <View style={{gap:4}}>
          <T role="label" tone="tertiary">GIFT A SERVICE</T>
          <T role="heading">Buy a gift</T>
        </View>
      </View>
      <View>
        <Row title={serviceName} detail="Any car, one use" trailing={<View style={{alignItems:"flex-end",gap:2}}><T role="caption" tone="tertiary">Gift value</T><T role="title">{rupees(amountPaise)}</T></View>} last />
      </View>
      <View style={{gap:10}}>
        <InfoLine icon="history">{`Valid ${GIFT_VALID_DAYS} days from purchase · No extensions`}</InfoLine>
        <GiftRestrictions />
      </View>
      {canPay
        ? <Button label={`Pay ${rupees(amountPaise)}`} busy={busy} disabled={disabled??false} onPress={onPay} style={{alignSelf:"flex-end"}} />
        : <T role="caption" tone="tertiary">Buying a gift works in the browser at app.autodeck.in.</T>}
    </View></Pane>
  );
}
