import { useEffect, useState } from "react";
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Pane, Row, T } from "./kit";
import { Linking } from "react-native";
import { PICKUP_FEE_PER_LEG_PAISE, PICKUP_FREE_KM, PICKUP_MAX_KM, pickupFeePaise, pickupZone } from "@autodeck/core";
import { STUDIO_INFO } from "../lib/studio-info";
import { getDeviceLocation, getPickupRequest, listenToPickupRequest, requestPickupDrop, type PickupRequest } from "../lib/pickup-service";

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
const LEG = `Rs ${PICKUP_FEE_PER_LEG_PAISE / 100}`;
const feeText = (kind: "pickup" | "drop" | "both") => `Rs ${pickupFeePaise("fee", kind) / 100}`;
const POLICY = `Free within ${PICKUP_FREE_KM} km of the studio. From ${PICKUP_FREE_KM} to ${PICKUP_MAX_KM} km it is ${LEG} for pickup and ${LEG} for drop-off. Further than that, please call the studio. The fee is paid at the studio.`;

export function PickupCard({ bookingId }: { bookingId: string }) {
  const [req, setReq] = useState<PickupRequest | null>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PickupRequest["kind"]>("both");
  const [address, setAddress] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [dropTime, setDropTime] = useState("");
  const [where, setWhere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => listenToPickupRequest(bookingId, setReq, () => setError("Could not load pickup details. Reopen this booking to try again.")), [bookingId]);

  const zone = where ? pickupZone(where) : null;
  async function locate() {
    setLocating(true);
    setError(null);
    const p = await getDeviceLocation();
    setWhere(p);
    if (!p) setError("We could not get your location. You can still send the request and the studio will check the distance.");
    setLocating(false);
  }

  async function send() {
    if (zone?.tier === "blocked") { setError(`We collect and return cars within ${PICKUP_MAX_KM} km of the studio. Please call us to arrange it.`); return; }
    if (address.trim().length < 8) { setError("Enter the full address."); return; }
    setBusy(true);
    setError(null);
    try {
      await requestPickupDrop({
        bookingId,
        kind,
        address: address.trim(),
        ...(where ? { lat: where.lat, lng: where.lng } : {}),
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
          <Row title="Distance" detail={POLICY} />
          {typeof req.feePaise === "number" ? <Row title="Pickup and drop fee" detail={req.memberMembershipId ? "Free with your membership" : req.feePaise === 0 ? "Free" : `Rs ${req.feePaise / 100}`} /> : null}
          {req.staffNote ? <Row title="Studio note" detail={req.staffNote} /> : null}
          <Row title="Payment" detail="Pay at the studio along with your service. Nothing is charged online." last />
        </Pane>
      ) : open ? (
        <Pane pad="inset">
          <View style={{ gap: space.line }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
              {KINDS.map((k) => <Button key={k.value} label={k.label} kind={kind === k.value ? "primary" : "quiet"} onPress={() => setKind(k.value)} style={{ flexGrow: 1 }} />)}
            </View>
            <T role="caption" tone="secondary">{POLICY}</T>
            <Field label="Address" value={address} onChangeText={setAddress} placeholder="House, street, area" multiline />
            <Button label={where ? "Location added" : "Use my location to check distance"} kind="quiet" busy={locating} onPress={() => void locate()} />
            {zone ? <T role="caption" tone={zone.tier === "blocked" ? "danger" : "secondary"}>{zone.tier === "free" ? `About ${zone.km} km from the studio. Free.` : zone.tier === "fee" ? `About ${zone.km} km from the studio. ${feeText(kind)} for ${kind === "both" ? "pickup and drop-off" : kind === "pickup" ? "pickup" : "drop-off"}.` : `About ${zone.km} km from the studio. Please call us to arrange it.`}</T> : null}
            {zone?.tier === "blocked" && STUDIO_INFO.phone ? <Button label="Call the studio" kind="quiet" onPress={() => void Linking.openURL(`tel:${STUDIO_INFO.phone}`)} /> : null}
            {kind !== "drop" ? <Field label={kind === "both" ? "Preferred pickup time (optional)" : "Preferred time (optional)"} value={pickupTime} onChangeText={setPickupTime} placeholder="e.g. Saturday morning" /> : null}
            {kind !== "pickup" ? <Field label="Preferred drop-off time (optional)" value={dropTime} onChangeText={setDropTime} placeholder="e.g. Sunday evening" /> : null}
            <T role="caption" tone="secondary">This is your preference, not a confirmed slot. The studio agrees the exact time with you by phone call.</T>
            {error ? <T role="caption" tone="danger">{error}</T> : null}
            <Button label="Send request" busy={busy} disabled={zone?.tier === "blocked"} onPress={() => void send()} />
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
