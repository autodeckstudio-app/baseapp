import { useEffect, useState } from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Pane, Row, T } from "./kit";
import { getPickupRequest, listenToPickupRequest, requestPickupDrop, type PickupRequest } from "../lib/pickup-service";

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
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
  return `${date} at ${time}`;
}

/** Ask the studio to collect or return the car. It is a request: the studio confirms it. */
export function PickupCard({ bookingId }: { bookingId: string }) {
  const [req, setReq] = useState<PickupRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PickupRequest["kind"]>("both");
  const [address, setAddress] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => listenToPickupRequest(bookingId, setReq, () => setError("Could not load pickup details. Reopen this booking to try again.")), [bookingId]);

  async function send() {
    if (address.trim().length < 8) { setError("Enter the full address."); return; }
    setBusy(true);
    setError(null);
    try {
      await requestPickupDrop({
        bookingId,
        kind,
        address: address.trim(),
        ...(kind !== "drop" && pickupTime.trim() ? { requestedPickupTime: pickupTime.trim() } : {}),
        ...(kind !== "pickup" && dropTime.trim() ? { requestedDropTime: dropTime.trim() } : {}),
      });
      setReq(await getPickupRequest(bookingId));
      setOpen(false);
    } catch {
      setError("We could not send the request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const wantsPickup = req?.kind === "pickup" || req?.kind === "both";
  const wantsDrop = req?.kind === "drop" || req?.kind === "both";
  const active = req && req.status !== "DECLINED";
  return (
    <View style={{ gap: space.line }}>
      <Kicker>Pickup and drop</Kicker>
      {active ? (
        <Pane pad="gap">
          <Row title={KINDS.find((k) => k.value === req.kind)?.label ?? "Pickup"} detail={req.address} />
          <Row title="Status" detail={STATUS[req.status]} />
          {req.status === "CONFIRMED" || req.status === "DONE" ? (
            <>
              {wantsPickup && req.agreedPickupAt ? <Row title="Pickup time" detail={formatAgreed(req.agreedPickupAt)} /> : null}
              {wantsDrop && req.agreedDropAt ? <Row title="Drop-off time" detail={formatAgreed(req.agreedDropAt)} /> : null}
            </>
          ) : (
            <>
              {wantsPickup && (req.requestedPickupTime || req.preferredTime) ? <Row title={req.kind === "both" ? "Requested pickup" : "Requested time"} detail={req.requestedPickupTime || req.preferredTime} /> : null}
              {wantsDrop && req.requestedDropTime ? <Row title="Requested drop-off" detail={req.requestedDropTime} /> : null}
              <Row title="Timing" detail="The studio confirms the exact time with you by phone call." />
            </>
          )}
          <Row title="Pricing" detail="Free within 5 km of the studio. Beyond 5 km: Rs 100 for pickup and Rs 100 for drop-off (Rs 200 for both). The studio confirms the charge." />
          {req.staffNote ? <Row title="Studio note" detail={req.staffNote} /> : null}
          <Row title="Payment" detail="Pay at the studio along with your service. Nothing is charged online." last />
        </Pane>
      ) : open ? (
        <Pane pad="inset">
          <View style={{ gap: space.line }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
              {KINDS.map((k) => <Button key={k.value} label={k.label} kind={kind === k.value ? "primary" : "quiet"} onPress={() => setKind(k.value)} style={{ flexGrow: 1 }} />)}
            </View>
            <T role="caption" tone="secondary">Free pickup and drop within 5 km of the studio. Beyond 5 km it is Rs 100 for pickup and Rs 100 for drop-off (Rs 200 for both). You pay at the studio.</T>
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="House, street, area" multiline />
            {kind !== "drop" ? <Field label={kind === "both" ? "Preferred pickup time (optional)" : "Preferred time (optional)"} value={pickupTime} onChangeText={setPickupTime} placeholder="e.g. Saturday morning" /> : null}
            {kind !== "pickup" ? <Field label="Preferred drop-off time (optional)" value={dropTime} onChangeText={setDropTime} placeholder="e.g. Sunday evening" /> : null}
            <T role="caption" tone="secondary">This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.</T>
            {error ? <T role="caption" tone="danger">{error}</T> : null}
            <Button label="Send request" busy={busy} onPress={() => void send()} />
            <Button label="Cancel" kind="quiet" onPress={() => setOpen(false)} />
          </View>
        </Pane>
      ) : (
        <Pane pad="gap">
          {req?.status === "DECLINED" ? <T role="caption" tone="secondary">The studio could not approve this pickup or drop-off request.{req.staffNote ? ` ${req.staffNote}` : ""}</T> : <T role="caption" tone="secondary">Want us to collect or return your car? Send a request and the studio will confirm.</T>}
          <Button style={{marginTop:space.line}} label="Request pickup or drop" kind="quiet" onPress={() => setOpen(true)} />
        </Pane>
      )}
    </View>
  );
}
