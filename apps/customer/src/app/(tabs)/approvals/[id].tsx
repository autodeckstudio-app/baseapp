import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { ApprovalRequest, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { listenToApproval, respondToApproval } from "../../../lib/approval-service";
import { db } from "../../../lib/firebase";

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for your decision",
  approved: "Approved — authorized to proceed",
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
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const [confirming, setConfirming] = useState<"approved" | "rejected" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return undefined;
    return listenToApproval(
      id,
      (data) => {
        setApproval(data);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [id]);

  useEffect(() => {
    if (!approval?.vehicleId) return;
    void getDoc(doc(db, COLLECTIONS.vehicles(), approval.vehicleId)).then((snap) => {
      if (snap.exists()) setVehicle(snap.data() as Vehicle);
    });
  }, [approval?.vehicleId]);

  async function handleDecision(decision: "approved" | "rejected") {
    if (!id) return;
    setDeciding(true);
    setActionError(null);
    try {
      await respondToApproval(id, decision);
      setConfirming(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to record your decision.");
    } finally {
      setDeciding(false);
    }
  }

  if (loading) return <Loading label="Opening the request" />;
  if (error) {
    return (
      <Screen>
        <Notice title="Can't load this request" body={error} action={<Button label="Go back" onPress={() => router.back()} />} />
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
        <Row title="Car" detail={vehicle ? `${vehicle.make} ${vehicle.model}` : "—"} />
        <Row title="Additional service" detail={approval.serviceName} />
        <Row title="Reason" detail={approval.reason} />
        <Row title="Requested" detail={formatWhen(approval.createdAt)} last />
      </Pane>

      <Pane pad="gap">
        <Row title="Current total" trailing={<T role="data">{rupees(approval.originalAmount)}</T>} />
        <Row title="Additional cost" trailing={<T role="data" tone="accent">+{rupees(approval.priceImpact)}</T>} />
        <Row title={<T role="heading">New total</T>} trailing={<T role="heading">{rupees(approval.newTotal)}</T>} last />
      </Pane>

      {actionError ? <Notice title="Something went wrong" body={actionError} /> : null}

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
            <Button label="Approve" onPress={() => setConfirming("approved")} />
            <Button label="Decline" kind="danger" onPress={() => setConfirming("rejected")} />
          </View>
        )
      ) : (
        <Button label="Back to booking" kind="quiet" onPress={() => router.back()} />
      )}
    </Screen>
  );
}
