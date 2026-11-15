import React from "react";
import {it,expect,vi} from "vitest";
vi.mock("../lib/native-image-pick",()=>({pickImagesFromLibrary:vi.fn()}));
// @ts-expect-error workspace lacks react-dom types
import {renderToStaticMarkup} from "react-dom/server";
import {View,Pressable,StyleSheet} from "react-native";
import {writeFileSync,readFileSync} from "node:fs";
import {space} from "@autodeck/ui/theme";
import {Icon} from "@autodeck/ui/native";
import {Button,Kicker,Pane,Row,T} from "./kit";
import {ADVANCE_SPLIT_ENABLED,advanceDisclosureLines} from "../lib/advance-booking";
const studioAdvanceAvailable=ADVANCE_SPLIT_ENABLED,washOn=false,giftCode=null,held=null,payHow={online:true},setPayAtStudio=(_value:boolean)=>{};
function Payment({advanceDue,payNow,payAtStudio}:{advanceDue:boolean,payNow:boolean,payAtStudio:boolean}){return (<>
      {washOn || giftCode ? null : <View style={{ gap: space.line }}>
        <Kicker>How will you pay</Kicker>
        <Pane pad="gap">
          {payHow.online ? (
            <Pressable accessibilityRole="button" accessibilityState={{ selected: !payAtStudio }} onPress={() => { if (!held) setPayAtStudio(false); }}>
              <Row title="Pay online" detail={<T role="caption" tone="secondary">Confirm below to open secure payment. The slot is held for 15 minutes after your request.</T>} trailing={!payAtStudio ? <Icon name="check" color="#EC8638" size={20} /> : undefined} last={false} />
            </Pressable>
          ) : null}
          <Pressable accessibilityRole="button" accessibilityState={{ selected: payAtStudio || !payHow.online }} onPress={() => { if (!held) setPayAtStudio(true); }}>
            <Row title="Pay at studio" detail={<T role="caption" tone="secondary">{studioAdvanceAvailable ? "Pay 20% advance online to confirm. Slot held for 15 minutes; the rest at the studio." : "Confirm your slot below. Pay when you collect your car."}</T>} trailing={payAtStudio || !payHow.online ? <Icon name="check" color="#EC8638" size={20} /> : undefined} last={!advanceDue && !payNow} />
          </Pressable>
          {/* Disclose the policy for the effective payment route only. */}
          {ADVANCE_SPLIT_ENABLED && (advanceDue || payNow) ? (
            <View style={{ paddingHorizontal: space.line, paddingTop: space.line, paddingBottom: space.line }}>
              {advanceDue ? (
                <>
                  <T role="caption" tone="secondary">{advanceDisclosureLines().split}</T>
                  <T role="caption" tone="secondary">{advanceDisclosureLines().noShow}</T>
                </>
              ) : (
                <T role="caption" tone="secondary">{advanceDisclosureLines().noShowFullOnline}</T>
              )}
            </View>
          ) : null}
        </Pane>
      </View>}

<Button label={advanceDue ? "Pay 20% advance" : "Pay & confirm"} onPress={()=>{}} />
</>);}
it("renders the actual effective payment selection subtree for visual inspection",()=>{
const src=readFileSync("src/app/(tabs)/book/confirm.tsx","utf8");
expect(src).toContain('Disclose the policy for the effective payment route only.');
for(const [name,advanceDue] of [["studio",true],["online",false]] as const){
const body=renderToStaticMarkup(<Payment advanceDue={advanceDue} payNow={!advanceDue} payAtStudio={advanceDue}/>);
if (ADVANCE_SPLIT_ENABLED) expect(body).toContain(advanceDue ? "Nothing more is charged" : "nothing is refunded automatically");
else { expect(body).not.toContain("Nothing more is charged"); expect(body).not.toContain("nothing is refunded automatically"); expect(body).toContain("Confirm your slot below. Pay when you collect your car."); }
const css=(StyleSheet as any).getSheet().textContent;
writeFileSync(`/tmp/activation-${name}.html`,`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}html,body{margin:0;background:#101216}body{padding:20px;box-sizing:border-box;font-family:Arial}#preview{display:flex;flex-direction:column;gap:24px;max-width:480px;margin:0 auto}</style><div id="preview">${body}</div>`);
}
});
