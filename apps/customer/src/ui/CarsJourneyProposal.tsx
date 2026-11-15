// Private design proposal only. Not mounted in the customer app; no consent,
// inspection promise, transfer service or commercial term is activated here.
import { View } from "react-native";
import { Button, Kicker, Pane, T } from "./kit";
export type CarsJourneyStage = "seller" | "buyer" | "admin";
export function CarsJourneyProposal({stage}:{stage:CarsJourneyStage}) {
  const seller=stage==="seller",admin=stage==="admin";
  const checks=admin?["Enquiry received", "Viewing or inspection discussed", "Buyer and seller checks pending", "Sale outcome not confirmed"]:["Match the seller and car to the RC", "Check insurance and outstanding finance", "Agree the condition, price and handover in writing", "Keep transfer submission and acknowledgement"];
  return <View style={{padding:24,gap:18,maxWidth:560,width:"100%",alignSelf:"center"}}>
    <Kicker>Private proposal · not active</Kicker>
    <T role="title">{seller?"Before you send your car":admin?"One enquiry, clear next steps":"Before you buy"}</T>
    <T tone="secondary">{seller?"Your car goes to the admin for review before other customers can see it.":admin?"Keep Cars in the customer app and admin. No extra staff workflow or sale checkout.":"Ask the studio about the car, then arrange your own checks before agreeing a sale."}</T>
    {seller?<>
      <Pane pad="inset"><View style={{gap:12}}><T role="bodyStrong">Proposed seller declaration</T><T>I own this car or have the owner's permission to list it. The details and photos are accurate to the best of my knowledge, including known damage and finance.</T><T role="caption" tone="tertiary">Draft wording for review. No consent has been collected.</T></View></Pane>
      <Pane pad="inset"><View style={{gap:10}}><T role="bodyStrong">Who sees your details</T><T>Your name, phone and registration fields are not included in buyer listing responses. Enquiries go to the admin, not directly to the seller.</T><T role="caption" tone="secondary">Uploaded photos are unchanged and may show number plates or other personal details. Check each photo before sending; do not include personal documents.</T></View></Pane>
      <Button label="Review declaration" disabled onPress={()=>{}} />
    </>:<>
      <Pane pad="inset"><View style={{gap:12}}><T role="bodyStrong">{admin?"Follow-up checklist":"Your buying checklist"}</T>{checks.map((x,i)=><View key={x} style={{flexDirection:"row",gap:10}}><T tone="tertiary">{i+1}.</T><T style={{flex:1}}>{x}</T></View>)}</View></Pane>
      <Pane pad="inset"><View style={{gap:10}}><T role="bodyStrong">{admin?"Not the same as a completed sale":"Listing review is not an inspection"}</T><T>{admin?"Marking a listing sold removes it from browsing. It does not confirm payment, vehicle condition or legal ownership transfer.":"Ask what was checked and request an inspection if you need one. An approved listing does not itself confirm condition, clear finance or completed ownership transfer."}</T></View></Pane>
      <Button label={admin?"Review follow-up":"Ask the studio"} disabled onPress={()=>{}} />
    </>}
    <T role="caption" tone="tertiary">Preview only. No deposit, fee, commission, inspection guarantee or transfer service is offered. Final terms and declarations need approval before publication.</T>
  </View>;
}
