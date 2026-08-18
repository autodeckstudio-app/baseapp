import { useState, useEffect } from "react";
import { View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { ApprovalRequest, Vehicle } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import {
  colors,
  spacing,
  radius,
  typography,
  Button,
  Divider,
  StatusBadge,
  statusTone,
  LoadingState,
  ErrorState,
  formatPaise,
  formatDateShort,
  formatTime,
} from "@autodeck/ui";
import { listenToApproval, respondToApproval } from "../../../lib/approval-service";
import { db } from "../../../lib/firebase";

const STATUS_LABELS: Record<string, string> = {
  pending: "Waiting for your decision",
  approved: "Approved — authorized to proceed",
  rejected: "Declined",
  expired: "This request expired",
  cancelled: "Cancelled by the studio",
};

export default function ApprovalDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [approval, setApproval] = useState<ApprovalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

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
    try {
      await respondToApproval(id, decision);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to record your decision.");
    } finally {
      setDeciding(false);
    }
  }

  function confirmDecision(decision: "approved" | "rejected") {
    if (!approval) return;
    Alert.alert(
      decision === "approved" ? "Approve additional work?" : "Decline additional work?",
      decision === "approved"
        ? `This authorizes ${approval.serviceName} for ${formatPaise(approval.priceImpact)}. Your new total will be ${formatPaise(approval.newTotal)}.`
        : `The studio will not proceed with ${approval.serviceName}. Your original service continues as planned.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: decision === "approved" ? "Approve" : "Decline",
          style: decision === "approved" ? "default" : "destructive",
          onPress: () => void handleDecision(decision),
        },
      ],
    );
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={() => router.back()} />;
  if (!approval) return <ErrorState title="Approval not found" onRetry={() => router.back()} />;

  const isPending = approval.status === "pending";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.xl }}>
      <StatusBadge label={approval.status} tone={statusTone(approval.status)} />
      <Text style={{ ...typography.heading, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xxs }}>
        Additional work requested
      </Text>
      <Text style={{ ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl }}>
        {STATUS_LABELS[approval.status] ?? approval.status}
      </Text>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
        <Row label="Vehicle" value={vehicle ? `${vehicle.make} ${vehicle.model}` : "—"} />
        <Divider spacingY="sm" />
        <Row label="Additional service" value={approval.serviceName} />
        <Divider spacingY="sm" />
        <Row label="Reason" value={approval.reason} />
        <Divider spacingY="sm" />
        <Row label="Requested" value={`${formatDateShort(approval.createdAt)} · ${formatTime(approval.createdAt)}`} />
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.xl }}>
        <Row label="Current total" value={formatPaise(approval.originalAmount)} />
        <Divider spacingY="sm" />
        <Row label="Additional cost" value={`+${formatPaise(approval.priceImpact)}`} accent />
        <Divider spacingY="sm" />
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ ...typography.title, color: colors.textPrimary }}>New total</Text>
          <Text style={{ ...typography.price, color: colors.textPrimary }}>{formatPaise(approval.newTotal)}</Text>
        </View>
      </View>

      {isPending ? (
        <>
          <Button label="Approve" onPress={() => confirmDecision("approved")} loading={deciding} />
          <View style={{ height: spacing.sm }} />
          <Button label="Decline" onPress={() => confirmDecision("rejected")} loading={deciding} variant="destructive" />
        </>
      ) : (
        <Button label="Back to booking" onPress={() => router.back()} variant="secondary" />
      )}
    </ScrollView>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ ...typography.body, color: colors.textMuted }}>{label}</Text>
      <Text
        style={{
          ...typography.bodyMedium,
          color: accent ? colors.accent : colors.textPrimary,
          maxWidth: "60%",
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
