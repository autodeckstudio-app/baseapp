import React from "react";
import {it,expect,vi} from "vitest";
vi.mock("../lib/native-image-pick",()=>({pickImagesFromLibrary:vi.fn()}));
// @ts-expect-error existing workspace lacks react-dom types
import {renderToStaticMarkup} from "react-dom/server";
import {View,StyleSheet} from "react-native";
import {writeFileSync,readFileSync} from "node:fs";
import {space} from "@autodeck/ui/theme";
import {Button,Field,Kicker,Pane,T} from "./kit";
import {SelectField} from "./inputs";
import {PICKUP_POLICY} from "../lib/pickup-policy";
const PICKUP_KINDS=[{value:"pickup",label:"Pickup"},{value:"drop",label:"Drop-off"},{value:"both",label:"Pickup and drop"}];
const choosePickupKind=(..._args:any[])=>{},setPickupAddress=()=>{},locatePickup=()=>{},setPickupSlot=()=>{},describePickupQuote=(..._args:any[])=>"";
const pickupAddress="",pickupWhere=null,pickupQuoteInfo=null,pickupQuoteError=null,studioHours={status:"unavailable"},pickupSlots:any[]=[],chosenSlot="",locating=false;
function Before({pickupKind}:{pickupKind:string|null}){return (      <View style={{ gap: space.line }}>
        <Kicker>Pickup and drop (optional)</Kicker>
        <Pane pad="gap">
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
            {PICKUP_KINDS.map((k) => <Button key={k.value} label={k.label} kind={pickupKind === k.value ? "primary" : "quiet"} onPress={() => choosePickupKind(k.value)} style={{ flexGrow: 1 }} />)}
          </View>
          {pickupKind ? (
            <View style={{ gap: space.line, marginTop: space.line }}>
              <T role="caption" tone="secondary">{PICKUP_POLICY}</T>
              <Field
                label="Address"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="e.g. 12, Sunrise Apartments, CG Road"
                multiline
                error={pickupAddress.trim().length > 0 && pickupAddress.trim().length < 8 ? "Enter the full address" : undefined}
              />
              <Button label={pickupWhere ? "Location added" : "Use my location to check distance"} kind="quiet" busy={locating} onPress={() => void locatePickup()} />
              {pickupQuoteInfo ? <T role="caption" tone="secondary">{describePickupQuote(pickupQuoteInfo)}</T> : null}
              {pickupQuoteError ? <T role="caption" tone="secondary">{pickupQuoteError}</T> : null}
              {pickupKind !== "drop" && studioHours.status === "loading" ? (
                <T role="caption" tone="secondary">Checking the studio's hours for pickup times...</T>
              ) : null}
              {pickupKind !== "drop" && pickupSlots.length > 0 ? (
                <>
                  <SelectField
                    label={pickupKind === "both" ? "Preferred pickup time (optional)" : "Preferred time (optional)"}
                    value={chosenSlot}
                    onChange={setPickupSlot}
                    options={[{ value: "", label: "No preference" }, ...pickupSlots.map((s) => ({ value: s, label: s }))]}
                  />
                  <T role="caption" tone="secondary">This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.</T>
                </>
              ) : null}
            </View>
          ) : (
            <T role="caption" tone="secondary">Want us to collect or return your car? Choose one above and it goes with your booking.</T>
          )}
        </Pane>
      </View>);}
function After({pickupKind}:{pickupKind:string|null}){return (      <View style={{ gap: space.line }}>
        <Kicker>Pickup and drop (optional)</Kicker>
        <Pane pad="gap" style={{ gap: space.gap }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
            {PICKUP_KINDS.map((k) => <Button key={k.value} label={k.label} kind={pickupKind === k.value ? "primary" : "quiet"} onPress={() => choosePickupKind(k.value)} style={{ flexGrow: 1 }} />)}
          </View>
          {pickupKind ? (
            <View style={{ gap: space.line }}>
              <T role="caption" tone="secondary">{PICKUP_POLICY}</T>
              <Field
                label="Address"
                value={pickupAddress}
                onChangeText={setPickupAddress}
                placeholder="e.g. 12, Sunrise Apartments, CG Road"
                multiline
                error={pickupAddress.trim().length > 0 && pickupAddress.trim().length < 8 ? "Enter the full address" : undefined}
              />
              <Button label={pickupWhere ? "Location added" : "Use my location to check distance"} kind="quiet" busy={locating} onPress={() => void locatePickup()} />
              {pickupQuoteInfo ? <T role="caption" tone="secondary">{describePickupQuote(pickupQuoteInfo)}</T> : null}
              {pickupQuoteError ? <T role="caption" tone="secondary">{pickupQuoteError}</T> : null}
              {pickupKind !== "drop" && studioHours.status === "loading" ? (
                <T role="caption" tone="secondary">Checking the studio's hours for pickup times...</T>
              ) : null}
              {pickupKind !== "drop" && pickupSlots.length > 0 ? (
                <>
                  <SelectField
                    label={pickupKind === "both" ? "Preferred pickup time (optional)" : "Preferred time (optional)"}
                    value={chosenSlot}
                    onChange={setPickupSlot}
                    options={[{ value: "", label: "No preference" }, ...pickupSlots.map((s) => ({ value: s, label: s }))]}
                  />
                  <T role="caption" tone="secondary">This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.</T>
                </>
              ) : null}
            </View>
          ) : (
            <T role="caption" tone="secondary">Choose pickup, drop-off or both to add it to your booking.</T>
          )}
        </Pane>
      </View>);}
it("renders actual pickup section before and after, unchanged fee policy and aligned spacing",()=>{
const src=readFileSync("src/app/(tabs)/book/confirm.tsx","utf8");
expect(src).toContain('<Pane pad="gap" style={{ gap: space.gap }}>');
expect(src).not.toContain('gap: space.line, marginTop: space.line');
for(const [version,C] of [["before",Before],["after",After]] as const){
for(const [state,kind] of [["idle",null],["selected","pickup"]] as const){
const body=renderToStaticMarkup(<C pickupKind={kind}/>);if(kind)expect(body).toContain(PICKUP_POLICY);
const css=(StyleSheet as any).getSheet().textContent;
writeFileSync(`/tmp/pickup-${version}-${state}.html`,`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}html,body{margin:0;background:#101216}body{padding:24px;box-sizing:border-box;font-family:Arial}#preview{max-width:720px;margin:0 auto}</style><div id="preview">${body}</div>`);
}}
});
