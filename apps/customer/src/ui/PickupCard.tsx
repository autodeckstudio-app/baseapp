import { useEffect, useState } from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Pane, Row, T } from "./kit";
import { getPickupRequest, requestPickupDrop, type PickupRequest } from "../lib/pickup-service";

const KINDS: { value: PickupRequest["kind"]; label: string }[] = [
  { value: "pickup", label: "Pick up" },
  { value: "drop", label: "Drop back" },
  { value: "both", label: "Both" },
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

  useEffect(() => { void getPickupRequest(bookingId).then(setReq).catch(() => undefined); }, [bookingId]);

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
          <Row title="Charge" detail={req.staffNote ? req.staffNote : req.status === "REQUESTED" ? "Free up to 5 km. Beyond 5 km: Rs 100 per pickup and Rs 100 per drop." : "Free up to 5 km"} />
          <Row title="Payment" detail="Pay at the studio along with your service. Nothing is charged online." last />
        </Pane>
      ) : open ? (
        <Pane pad="inset">
          <View style={{ gap: space.line }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
              {KINDS.map((k) => <Button key={k.value} label={k.label} kind={kind === k.value ? "primary" : "quiet"} onPress={() => setKind(k.value)} style={{ flexGrow: 1 }} />)}
            </View>
            <T role="caption" tone="secondary">Free pickup and drop within 5 km of the studio. Beyond 5 km it is Rs 100 for pickup and Rs 100 for drop (Rs 200 for both). You pay at the studio.</T>
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="House, street, area" multiline />
            <Field label="Preferred time (optional)" value={time} onChangeText={setTime} placeholder="e.g. Saturday morning" />
            {error ? <T role="caption" tone="danger">{error}</T> : null}
            <Button label="Send request" busy={busy} onPress={() => void send()} />
            <Button label="Cancel" kind="quiet" onPress={() => setOpen(false)} />
          </View>
        </Pane>
      ) : (
        <Pane pad="gap">
          {req?.status === "DECLINED" ? <T role="caption" tone="secondary">The studio could not do this pickup.{req.staffNote ? ` ${req.staffNote}` : ""}</T> : <T role="caption" tone="secondary">Want us to collect or return your car? Send a request and the studio will confirm.</T>}
          <Button label="Request pickup or drop" kind="quiet" onPress={() => setOpen(true)} />
        </Pane>
      )}
    </View>
  );
}
