import { useState, useEffect, useRef } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import type { ApprovalRequest, Vehicle, Booking, ServiceJob } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { listenToApproval, respondToApproval } from "../../../lib/approval-service";
import { db } from "../../../lib/firebase";

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for your decision",
  approved: "Approved - authorized to proceed",
  rejected: "Declined",
  expired: "This request expired",
  cancelled: "Cancelled by the studio",
};

const STATUS_TONE: Record<string, "neutral" | "accent" | "premium" | "danger"> = {
  pending: "accent",
  approved: "premium",
  rejected: "danger",
  expired: "neutral",
  cancelled: "neutral",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`;
}

export default function ApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [retryTick,setRetryTick] = useState(0);
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [confirming, setConfirming] = useState<"approved" | "rejected" | null>(null);
  const [quoteScopeRead,setQuoteScopeRead]=useState<"loading"|"ready"|"error">("loading");
  const [linkedBooking,setLinkedBooking]=useState<Booking|null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const approvalRef=useRef(approval);approvalRef.current=approval;const scopeRef=useRef(id);scopeRef.current=id;const generation=useRef(0);const decidingRef=useRef(false);
  useEffect(() => {
    generation.current++;setDeciding(false);decidingRef.current=false;
    setApproval(null);setVehicle(null);setConfirming(null);setActionError(null);if (!id) {setLoading(false);return undefined;}
    setLoading(true);setError(null);
    let alive=true;const stop=listenToApproval(
      id,
      (data) => {
        if(!alive)return;setError(null);setApproval(data);
        setLoading(false);
      },
      (err) => {
        if(!alive)return;setError("This request could not load. Check your connection and retry.");
        setLoading(false);
      },
    );return()=>{generation.current++;alive=false;stop()};
  }, [id,retryTick]);

  useEffect(() => {
    let alive=true;setVehicle(null);if (!approval?.vehicleId) return;
    void getDoc(doc(db, COLLECTIONS.vehicles(), approval.vehicleId)).then((snap) => {
      if (alive&&snap.exists()) setVehicle(snap.data() as Vehicle);
    }).catch(()=>{if(alive)setVehicle(null)});return()=>{alive=false};
  }, [approval?.vehicleId]);

  useEffect(()=>{setQuoteScopeRead(approval?.jobId?"loading":"ready");setLinkedBooking(null);let active=true;let stop:(()=>void)|undefined;if(approval?.jobId){void getDoc(doc(db,COLLECTIONS.jobs(),approval.jobId)).then(snap=>{const job=snap.data() as ServiceJob|undefined;if(active&&!job?.bookingId)setQuoteScopeRead(snap.exists()?"ready":"error");if(active&&job?.bookingId)stop=onSnapshot(doc(db,COLLECTIONS.bookings(),job.bookingId),b=>{if(active){setLinkedBooking(b.exists()?b.data() as Booking:null);setQuoteScopeRead(b.exists()?"ready":"error")}},()=>{if(active){setLinkedBooking(null);setQuoteScopeRead("error")}});}).catch(()=>{if(active){setLinkedBooking(null);setQuoteScopeRead("error")}});}return()=>{active=false;stop?.()};},[approval?.jobId]);
  const initialQuotePending=Boolean(linkedBooking&&(linkedBooking.priceOnRequest||(linkedBooking as Booking & {requiresPriceApproval?:boolean}).requiresPriceApproval)&&linkedBooking.quoteStatus!=="approved");
  async function handleDecision(decision: "approved" | "rejected") {
    if(decision==="approved"&&(initialQuotePending||quoteScopeRead!=="ready"))return;
    if (!id || decidingRef.current || approvalRef.current?.status!=="pending"||scopeRef.current!==id) return;
    const scope=id,gen=generation.current;decidingRef.current=true;
    setDeciding(true);
    setActionError(null);
    try {
      await respondToApproval(id, decision);
      if(scopeRef.current===scope&&generation.current===gen)setConfirming(null);
    } catch (err) {
      if(scopeRef.current===scope&&generation.current===gen)setActionError(err instanceof Error ? err.message : "Failed to record your decision.");
    } finally {
      if(scopeRef.current===scope&&generation.current===gen){decidingRef.current=false;setDeciding(false);}
    }
  }

  if (loading) return <Loading label="Opening the request" />;
  if (error) {
    return (
      <Screen>
        <Notice title="Can't load this request" body={error} action={<Button icon="refresh" label="Retry" onPress={() => setRetryTick(n=>n+1)} />} />
      </Screen>
    );
  }
  if (!approval) {
    return (
      <Screen>
        <Notice title="Approval not found" body="It may have been withdrawn." action={<Button label="Go back" onPress={() => router.back()} />} />
      </Screen>
    );
  }

  const isPending = approval.status === "pending";

  return (
    <Screen
      header={
        <View style={{ gap: space.breath }}>
          <Chip label={approval.status} tone={STATUS_TONE[approval.status] ?? "neutral"} />
          <T role="title">Additional work requested</T>
          <T tone="secondary">{STATUS_LABELS[approval.status] ?? approval.status}</T>
        </View>
      }
    >
      <Pane pad="gap">
        <Row title="Car" detail={vehicle ? `${vehicle.make} ${vehicle.model}` : "-"} />
        <Row title="Additional service" detail={approval.serviceName} />
        <Row title="Reason" detail={approval.reason} />
        <Row title="Requested" detail={formatWhen(approval.createdAt)} last />
      </Pane>

      <Pane pad="gap">
        <Row title="Current total" trailing={<T role="data">{rupees(approval.originalAmount)}</T>} />
        <Row title="Additional cost" trailing={<T role="data" tone="accent">+{rupees(approval.priceImpact)}</T>} />
        <Row title={<T role="heading">New total</T>} trailing={<T role="heading">{rupees(approval.newTotal)}</T>} last />
      </Pane>

      {actionError ? <Notice title="Could not complete that" body={actionError} /> : null}

      {isPending ? (
        confirming ? (
          <Notice
            title={confirming === "approved" ? "Approve additional work?" : "Decline additional work?"}
            body={
              confirming === "approved"
                ? `This authorizes ${approval.serviceName} for ${rupees(approval.priceImpact)}. Your new total will be ${rupees(approval.newTotal)}.`
                : `The studio will not proceed with ${approval.serviceName}. Your original service continues as planned.`
            }
            action={
              <View style={{ gap: space.breath }}>
                <Button
                  label={confirming === "approved" ? "Approve" : "Decline"}
                  kind={confirming === "approved" ? "primary" : "danger"}
                  busy={deciding}
                  onPress={() => void handleDecision(confirming)}
                />
                <Button label="Back" kind="quiet" onPress={() => setConfirming(null)} />
              </View>
            }
          />
        ) : (
          <View style={{ gap: space.breath }}>
            {quoteScopeRead!=="ready" ? <Notice title={quoteScopeRead==="loading"?"Checking the original quote":"Original quote could not load"} body="Your request stays here. Open the booking to check its original quote before approving additional work." action={<Button label="Open booking" onPress={()=>router.push(`/(tabs)/bookings/${approval.bookingId??approval.jobId}`)} />} /> : initialQuotePending ? <Notice title="Original quote approval needed" body="Your additional-work request stays here. Review the original quote on your booking first, then return to this request." action={<Button label="Open booking quote" onPress={()=>router.push(`/(tabs)/bookings/${linkedBooking?.id}`)} />} /> : <Button label="Approve" onPress={() => setConfirming("approved")} />}
            <Button label="Decline" kind="danger" onPress={() => setConfirming("rejected")} />
          </View>
        )
      ) : (
        <Button label="Back to booking" kind="quiet" onPress={() => router.back()} />
      )}
    </Screen>
  );
}
