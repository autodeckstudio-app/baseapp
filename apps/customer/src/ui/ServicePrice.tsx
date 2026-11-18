import {useEffect,useState} from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import type { PriceBreakdown } from "@autodeck/core";
import { priceErrorInfo } from "../lib/price-error";
import { Button, Notice, Pane, Row, T, rupees } from "./kit";

export type ServicePriceProps = {
  inlineBreakdown?: boolean;
  priceLabel?: string;
  compactQuote?: boolean;
  category: string;
  priceOnRequest: boolean;
  /** True when this service is priced by car size (PPF) and the selected car has no saved type, or there is no car. */
  needsCarType: boolean;
  hasCar: boolean;
  carSizeKnown: boolean;
  loading: boolean;
  error: string | null;
  breakdown: PriceBreakdown | null;
  onRetry: () => void;
  onGarage: () => void;
  onHelp?: () => void;
};

/** The price block of a service page. The car size is never chosen here: it is the selected car's saved type. */
export function ServicePrice(p: ServicePriceProps) {
  const { breakdown: priceBreakdown } = p;
  const hasBreakdown = priceBreakdown !== null && (priceBreakdown.scopeAdjustment !== 0 || priceBreakdown.addOns.length > 0 || Boolean(priceBreakdown.membershipDiscount) || Boolean(priceBreakdown.roundOffPaise) || priceBreakdown.tax !== 0 || priceBreakdown.basePrice !== priceBreakdown.total);
  const [detailsOpen,setDetailsOpen]=useState(false);
  useEffect(()=>setDetailsOpen(false),[priceBreakdown]);
  return (
    <>
          {p.priceOnRequest ? (p.compactQuote?null:
            <Pane pad="gap"><Row title="Discuss your requirements" detail={<T role="caption" tone="secondary">Tell us what you have in mind. Confirm the scope and quote before deciding on any work.</T>} last /></Pane>
          ) : p.needsCarType ? (
            <Pane pad="gap">
              <Row title={p.hasCar ? "Car type needed" : "Add your car"} detail={<T role="caption" tone="secondary">{p.hasCar ? "This price depends on your car's type. Add the type once in Garage, edit car." : "This price depends on your car's type. Add your car in Garage to see it."}</T>} />
              <Button label={p.hasCar ? "Edit car in Garage" : "Add a car"} kind="quiet" onPress={() => p.onGarage()} />
            </Pane>
          ) : !p.carSizeKnown ? (<T role="caption" tone="secondary">Working out your car type...</T>) : p.loading ? (
            <T role="caption" tone="tertiary">Working out the price...</T>
          ) : p.error ? (
            <View style={{ gap: space.line }}>
              <Notice title="Can't get the price" body={priceErrorInfo(p.error).body} />
              {priceErrorInfo(p.error).retry ? <Button icon="refresh" label="Try again" kind="quiet" onPress={() => p.onRetry()} /> : p.onHelp ? <Button label="Get help" kind="quiet" onPress={p.onHelp} /> : null}
            </View>
          ) : priceBreakdown !== null ? (
            <View style={{gap:12}}>
              <View testID="car-price-row" style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12,paddingVertical:4}}>{p.priceLabel?<T role="caption" tone="secondary" style={{flex:1}}>{p.priceLabel}</T>:null}<T role="title" style={{flexShrink:0,textAlign:"right"}}>{rupees(priceBreakdown.total)}</T></View>
              {p.inlineBreakdown||!hasBreakdown?null:<Row title={detailsOpen?"Hide price breakdown":"View price breakdown"} onPress={()=>setDetailsOpen(!detailsOpen)} last/>}
              {hasBreakdown&&(p.inlineBreakdown||detailsOpen)?<View><Row title="Base" trailing={<T role="data">{rupees(priceBreakdown.basePrice)}</T>} />
              {priceBreakdown.scopeAdjustment > 0 ? (
                <Row title="Vehicle size adjustment" trailing={<T role="data">+{rupees(priceBreakdown.scopeAdjustment)}</T>} />
              ) : null}
              {priceBreakdown.addOns.map((addOn) => (
                <Row key={addOn.id} title={addOn.name} trailing={<T role="data">{rupees(addOn.price)}</T>} />
              ))}
              {priceBreakdown.membershipDiscount !== null && priceBreakdown.membershipDiscount > 0 ? (
                <Row title="Membership discount" trailing={<T role="data" tone="premium">-{rupees(priceBreakdown.membershipDiscount)}</T>} />
              ) : null}
              {priceBreakdown.roundOffPaise ? <Row title="Round off" trailing={<T role="data">{rupees(priceBreakdown.roundOffPaise)}</T>} /> : null}
              {priceBreakdown.tax > 0 ? <Row title={priceBreakdown.taxDescription} trailing={<T role="data">{rupees(priceBreakdown.tax)}</T>} /> : null}
</View>:null}
            </View>
          ) : null}
    </>
  );
}
