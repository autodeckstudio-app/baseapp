import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { advanceJobStatus, assignBay, getStudioConfig } from "../../../lib/studio-service";
import {
  recordManualPayment,
  confirmPaymentMock,
  listenToPaymentForJob,
  listenToInvoiceForJob,
} from "../../../lib/payment-service";
import { getCustomerMembership } from "../../../lib/membership-service";
import type { ServiceJob, StudioConfig, Payment, Invoice, Booking, Membership } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import {
  colors,
  spacing,
  radius,
  typography,
  Button,
  StatusBadge,
  statusTone,
  LoadingState,
  ErrorState,
  formatPaise,
  formatTime,
} from "@autodeck/ui";

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting confirmation",
  processing: "Processing",
  completed: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const JOB_STATUS_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Awaiting Vehicle",
  VEHICLE_RECEIVED: "Vehicle Received",
  IN_PROGRESS: "In Progress",
  QUALITY_CHECK: "Quality Check",
  READY_FOR_DELIVERY: "Ready for Delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const ADVANCE_ACTION_LABELS: Record<string, string> = {
  PENDING_VEHICLE: "Check In Vehicle",
  VEHICLE_RECEIVED: "Start Work",
  IN_PROGRESS: "Send to QC",
  QUALITY_CHECK: "Mark Ready",
  READY_FOR_DELIVERY: "Mark Delivered",
};

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [paymentActionLoading, setPaymentActionLoading] = useState(false);
  const [bookingMembership, setBookingMembership] = useState<{
    membership: Membership;
    washUsed: boolean;
    discountApplied: boolean;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.jobs(), id),
      (snap) => {
        if (snap.exists()) {
          const j = snap.data() as ServiceJob;
          setJob(j);
          if (!config) {
            void getStudioConfig(j.studioId).then(setConfig);
          }
        }
        setLoading(false);
      },
      (err) => {
        Alert.alert("Error", err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!job) {
      setPayment(null);
      setInvoice(null);
      return;
    }
    const jobId = job.id;
    const unsubPayment = listenToPaymentForJob(jobId, job.tenantId, setPayment, () => undefined);
    const unsubInvoice = listenToInvoiceForJob(jobId, job.tenantId, setInvoice, () => undefined);
    return () => {
      unsubPayment();
      unsubInvoice();
    };
  }, [job?.id]);

  // Read-only membership status for this job's booking (if any) — studio can
  // see it but has no authority to alter it (doc08 §8.2).
  useEffect(() => {
    if (!job?.bookingId) {
      setBookingMembership(null);
      return;
    }
    void (async () => {
      const bookingSnap = await getDoc(doc(db, COLLECTIONS.bookings(), job.bookingId as string));
      if (!bookingSnap.exists()) return;
      const booking = bookingSnap.data() as Booking;
      if (!booking.membershipId) return;
      const membership = await getCustomerMembership(job.customerId, booking.membershipId);
      if (membership) {
        setBookingMembership({
          membership,
          washUsed: booking.membershipWashUsed,
          discountApplied: booking.membershipDiscountApplied,
        });
      }
    })();
  }, [job?.id]);

  async function handleRecordCashPayment() {
    const jobId = job?.id;
    if (!jobId) return;
    Alert.alert("Record cash payment?", "Confirms the customer paid in full at the studio.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setPaymentActionLoading(true);
          try {
            await recordManualPayment({ jobId, method: "cash" });
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to record payment.");
          } finally {
            setPaymentActionLoading(false);
          }
        },
      },
    ]);
  }

  async function handleConfirmPayment(result: "success" | "failure") {
    if (!payment) return;
    setPaymentActionLoading(true);
    try {
      await confirmPaymentMock(payment.id, result);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to update payment.");
    } finally {
      setPaymentActionLoading(false);
    }
  }

  async function handleAdvance() {
    if (!job || !id) return;
    setAdvancing(true);
    try {
      await advanceJobStatus(id);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to advance status.");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleReassignBay(bayId: string) {
    if (!job || !id) return;
    setReassigning(true);
    try {
      await assignBay({ jobId: id, bayId, reason: "Manual reassignment by studio" });
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to reassign bay.");
    } finally {
      setReassigning(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!job) return <ErrorState title="Job not found" />;

  const transitions = JOB_STATUS_TRANSITIONS[job.status] ?? [];
  const canAdvance = transitions.some((s) => s !== "CANCELLED");
  const advanceLabel = ADVANCE_ACTION_LABELS[job.status] ?? "Advance";
  const statusLabel = JOB_STATUS_LABELS[job.status] ?? job.status;

  const scheduledTime = new Date(job.scheduledAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  const compatibleBays = config?.bays.filter((b) => b.active && b.id !== job.bayId) ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: spacing.lg }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.lg }}>
        <StatusBadge label={statusLabel} tone={statusTone(job.status)} />
        {job.isWalkIn && <StatusBadge label="Walk-in" tone="accent" />}
      </View>

      <Section>
        <Row label="Bay" value={job.bayId} />
        <Row label="Service" value={job.serviceId} />
        <Row label="Scheduled" value={scheduledTime} />
        <Row label="Duration" value={`~${job.estimatedDurationMinutes} min`} />
        <Row label="Payment" value={job.paymentStatus} />
      </Section>

      {bookingMembership && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: colors.accentMuted,
            borderRadius: radius.lg,
            padding: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <StatusBadge label={`${bookingMembership.membership.tier} member`} tone="accent" />
          <Text style={{ ...typography.caption, color: colors.accentPressed, flexShrink: 1 }}>
            {bookingMembership.washUsed ? "Wash credit used" : bookingMembership.discountApplied ? "Membership discount applied" : "Member"}
          </Text>
        </View>
      )}

      <Text style={sectionTitle}>Status History</Text>
      <Section>
        {job.statusHistory.map((entry, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...typography.caption, color: colors.textPrimary }}>{JOB_STATUS_LABELS[entry.status] ?? entry.status}</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{formatTime(entry.changedAt)}</Text>
          </View>
        ))}
      </Section>

      <Text style={sectionTitle}>Payment</Text>
      <Section>
        <Row label="Status" value={payment ? PAYMENT_STATUS_LABELS[payment.status] ?? payment.status : "Not yet initiated"} />
        <Row label="Amount" value={formatPaise(job.totalAmount)} />
        {invoice && <Row label="Invoice" value={invoice.invoiceNumber} />}

        {!payment && (
          <Button
            label="Record cash payment"
            onPress={() => void handleRecordCashPayment()}
            loading={paymentActionLoading}
            size="md"
            style={{ marginTop: spacing.xs }}
          />
        )}
        {payment && (payment.status === "pending" || payment.status === "processing") && (
          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
            <View style={{ flex: 1 }}>
              <Button label="Confirm received" onPress={() => void handleConfirmPayment("success")} loading={paymentActionLoading} size="md" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Mark failed"
                onPress={() => void handleConfirmPayment("failure")}
                loading={paymentActionLoading}
                size="md"
                variant="destructive"
              />
            </View>
          </View>
        )}
      </Section>

      {canAdvance && (
        <Button label={advanceLabel} onPress={() => void handleAdvance()} loading={advancing} style={{ marginBottom: spacing.lg }} />
      )}

      {compatibleBays.length > 0 && job.status !== "DELIVERED" && job.status !== "CANCELLED" && (
        <>
          <Text style={sectionTitle}>Reassign Bay</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.lg }}>
            {compatibleBays.map((bay) => (
              <TouchableOpacity
                key={bay.id}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.md,
                  borderWidth: 1,
                  borderColor: colors.textPrimary,
                  opacity: reassigning ? 0.5 : 1,
                }}
                onPress={() => {
                  Alert.alert("Reassign Bay", `Move job to ${bay.name}?`, [
                    { text: "Cancel", style: "cancel" },
                    { text: "Confirm", onPress: () => void handleReassignBay(bay.id) },
                  ]);
                }}
                disabled={reassigning}
              >
                <Text style={{ ...typography.captionMedium, color: colors.textPrimary }}>{bay.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const sectionTitle = { ...typography.title, color: colors.textPrimary, marginBottom: spacing.sm } as const;

function Section({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.lg, gap: spacing.sm }}>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{label}</Text>
      <Text style={{ ...typography.captionMedium, color: colors.textPrimary, maxWidth: "60%", textAlign: "right" }}>{value}</Text>
    </View>
  );
}
