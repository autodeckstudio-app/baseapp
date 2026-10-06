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

/** Ask the studio to collect or return the car. It is a request: the studio confirms it. */
export function PickupCard({ bookingId }: { bookingId: string }) {
  const [req, setReq] = useState<PickupRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PickupRequest["kind"]>("both");
  const [address, setAddress] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => listenToPickupRequest(bookingId, setReq, () => setError("Could not load pickup details. Reopen this booking to try again.")), [bookingId]);

  async function send() {
    if (address.trim().length < 8) { setError("Enter the full address."); return; }
    setBusy(true);
    setError(null);
    try {
      await requestPickupDrop({ bookingId, kind, address: address.trim(), ...(time.trim() ? { preferredTime: time.trim() } : {}) });
      setReq(await getPickupRequest(bookingId));
      setOpen(false);
    } catch {
      setError("We could not send the request. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const active = req && req.status !== "DECLINED";
  return (
    <View style={{ gap: space.line }}>
      <Kicker>Pickup and drop</Kicker>
      {active ? (
        <Pane pad="gap">
          <Row title={KINDS.find((k) => k.value === req.kind)?.label ?? "Pickup"} detail={req.address} />
          <Row title="Status" detail={STATUS[req.status]} />
          {req.preferredTime ? <Row title="Preferred time" detail={req.preferredTime} /> : null}
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
            <Field label="Preferred time (optional)" value={time} onChangeText={setTime} placeholder="e.g. Saturday morning" />
            {error ? <T role="caption" tone="danger">{error}</T> : null}
            <Button label="Send request" busy={busy} onPress={() => void send()} />
            <Button label="Cancel" kind="quiet" onPress={() => setOpen(false)} />
          </View>
        </Pane>
      ) : (
        <Pane pad="gap">
          {req?.status === "DECLINED" ? <T role="caption" tone="secondary">The studio could not approve this pickup or drop-off request.{req.staffNote ? ` ${req.staffNote}` : ""}</T> : <T role="caption" tone="secondary">Want us to collect or return your car? Send a request and the studio will confirm.</T>}
          <Button label="Request pickup or drop" kind="quiet" onPress={() => setOpen(true)} />
        </Pane>
      )}
    </View>
  );
}
