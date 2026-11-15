import{RETAINED_TRANSPORT_PREVIEW,useRetainedTransportPreview}from'../lib/use-retained-transport-preview';
import{retainedTransportLabel}from'@autodeck/core';
import{FactHighlights}from "./FactHighlights";
import{rupees}from "./kit";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { Kicker, Pane, Row } from "./kit";
import { PICKUP_POLICY } from "../lib/pickup-policy";
import { completedLegRows } from "../lib/pickup-legs";
import { listenToPickupRequest, type PickupRequest } from "../lib/pickup-service";

const KINDS: { value: PickupRequest["kind"]; label: string }[] = [
  { value: "pickup", label: "Pickup" },
  { value: "drop", label: "Drop-off" },
  { value: "both", label: "Pickup and drop" },
];
const STATUS: Record<PickupRequest["status"], string> = {
  REQUESTED: "Waiting for studio approval",
  CONFIRMED: "Approved by the studio",
  DONE: "Done",
  DECLINED: "Declined by the studio",
};

function formatAgreed(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

// Pickup or drop is chosen while booking (book/confirm.tsx), not after. This
// card only shows the status of a request that already exists - waiting for
// approval, approved, declined, agreed times, fee and studio note, exactly as
// before. There is no request form or entry point here any more; for a
// booking with no request, nothing renders.
export function PickupCard({ bookingId, combinedPayment = false, transportScope = null }: { bookingId: string; combinedPayment?: boolean;transportScope?:string|null }) {
  const [result,setResult]=useState<{id:string;scope:string|null;req:PickupRequest|null;error:boolean}|null>(null);
  const req=result?.id===bookingId&&result.scope===transportScope?result.req:null;
  useEffect(() => {
    let alive=true;setResult(null);
    const stop=listenToPickupRequest(bookingId, value=>{if(alive)setResult({id:bookingId,scope:transportScope,req:value,error:false})}, ()=>{if(alive)setResult({id:bookingId,scope:transportScope,req:null,error:true})});
    return()=>{alive=false;stop()};
  }, [bookingId,transportScope]);

  const verified=useRetainedTransportPreview(transportScope,req?[bookingId]:null);
  if(RETAINED_TRANSPORT_PREVIEW&&(result?.error||req&&verified.status!=='ready'))return <View style={{gap:space.line}}><Kicker>Pickup and drop</Kicker><Pane pad="gap"><Row title="Status" detail={result?.error||verified.status==='unavailable'?'Requests unavailable':'Checking journey'} last/></Pane></View>;
  if (!req) return null;
  const row=verified.status==='ready'?verified.data.batch.rows[0]:null;
  const retained=RETAINED_TRANSPORT_PREVIEW&&row?.kind==='retained'?row.physical:null;

  const wantsPickup = req.kind === "pickup" || req.kind === "both";
  const wantsDrop = req.kind === "drop" || req.kind === "both";
  const active = req.status !== "DECLINED";
  return (
    <View style={{ gap: space.line }}>
      <Kicker>Pickup and drop</Kicker>
      {active ? (
        <Pane pad="gap">
          <Row title={KINDS.find((k) => k.value === req.kind)?.label ?? "Pickup"} detail={req.address} />
          <Row title="Status" detail={retained?retainedTransportLabel(retained):STATUS[req.status]} />
          {req.status === "CONFIRMED" || req.status === "DONE" ? (
            <>
              {wantsPickup && !retained?.unusedLegs.includes("pickup") && req.agreedPickupAt ? <Row title="Pickup time" detail={formatAgreed(req.agreedPickupAt)} /> : null}
              {wantsDrop && !retained?.unusedLegs.includes("drop") && req.agreedDropAt ? <Row title="Drop-off time" detail={formatAgreed(req.agreedDropAt)} /> : null}
              {completedLegRows(req).map((l) => <Row key={l.title} title={l.title} detail={formatAgreed(l.at)} />)}
            </>
          ) : (
            <>
              {wantsPickup && (req.requestedPickupTime || req.preferredTime) ? <Row title={req.kind === "both" ? "Requested pickup" : "Requested time"} detail={req.requestedPickupTime || req.preferredTime} /> : null}
              {wantsDrop && req.requestedDropTime ? <Row title="Requested drop-off" detail={req.requestedDropTime} /> : null}
              <Row title="Timing" detail="The studio confirms the exact time with you by phone call." />
            </>
          )}
          <Row title="Distance" detail={PICKUP_POLICY} />
          {typeof req.feePaise === "number" ? <FactHighlights facts={[{value:req.feePaise===0?"Free":rupees(req.feePaise),label:retained?"Original transport quote":req.memberMembershipId?"Pickup and drop · membership":"Confirmed pickup and drop fee"}]}/> : null}
          {req.staffNote ? <Row title="Studio note" detail={req.staffNote} /> : null}
          <Row title="Payment" detail={retained?"See booking bill":combinedPayment ? "Included in your booking total. Follow the booking payment status above." : "Pay at the studio along with your service. Nothing is charged online."} last />
        </Pane>
      ) : (
        <Pane pad="gap">
          <Row title={KINDS.find((k) => k.value === req.kind)?.label ?? "Pickup"} detail={req.address} />
          <Row title="Status" detail={retained?retainedTransportLabel(retained):STATUS[req.status]} last={!req.staffNote} />
          {req.staffNote ? <Row title="Studio note" detail={req.staffNote} last /> : null}
        </Pane>
      )}
    </View>
  );
}
