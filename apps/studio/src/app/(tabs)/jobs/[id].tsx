import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { advanceJobStatus, assignBay, getStudioConfig } from "../../../lib/studio-service";
import {
  recordManualPayment,
  confirmManualPayment,
  listenToPaymentForJob,
  listenToInvoiceForJob,
} from "../../../lib/payment-service";
import { getCustomerMembership } from "../../../lib/membership-service";
import { createApproval, cancelApproval, listenToApprovalsForJob, getActiveServices } from "../../../lib/approval-service";
import { listenToInspection, startInspection } from "../../../lib/inspection-service";
import type { ServiceJob, StudioConfig, Payment, Invoice, Booking, Membership, ApprovalRequest, Service, Inspection } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import {
  colors,
  spacing,
  radius,
  typography,
  Button,
  TextInput,
  StatusBadge,
  statusTone,
  LoadingState,
  ErrorState,
  formatPaise,
  formatTime,
} from "@autodeck/ui";

const APPROVAL_STATUS_LABELS: Record<string, string> = {
  pending: "Awaiting customer",
  approved: "Approved",
  rejected: "Declined",
  expired: "Expired",
  cancelled: "Cancelled",
};

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
  const router = useRouter();
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [startingInspection, setStartingInspection] = useState(false);
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
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [cancellingApprovalId, setCancellingApprovalId] = useState<string | null>(null);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [approvalReason, setApprovalReason] = useState("");
  const [creatingApproval, setCreatingApproval] = useState(false);

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

  // Live update: studio sees the customer's approve/reject decision the
  // moment it happens, via the same real-time listener pattern as
  // payment/invoice above (Phase 3 requirement — no separate polling).
  useEffect(() => {
    if (!job) {
      setApprovals([]);
      return undefined;
    }
    return listenToApprovalsForJob(job.id, job.tenantId, setApprovals, () => undefined);
  }, [job?.id]);

  useEffect(() => {
    if (!job) {
      setInspection(null);
      return undefined;
    }
    return listenToInspection(job.id, setInspection, () => undefined);
  }, [job?.id]);

  async function handleStartInspection() {
    if (!job) return;
    setStartingInspection(true);
    try {
      await startInspection(job.id);
      router.push(`/(tabs)/jobs/inspection/${job.id}`);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to start inspection.");
    } finally {
      setStartingInspection(false);
    }
  }

  async function handleCreateApproval() {
    if (!job || !selectedServiceId || !approvalReason.trim()) return;
    setCreatingApproval(true);
    try {
      await createApproval({ jobId: job.id, serviceId: selectedServiceId, reason: approvalReason.trim() });
      setShowApprovalForm(false);
      setSelectedServiceId(null);
      setApprovalReason("");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to request approval.");
    } finally {
      setCreatingApproval(false);
    }
  }

  async function handleCancelApproval(approvalId: string) {
    setCancellingApprovalId(approvalId);
    try {
      await cancelApproval(approvalId);
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed to cancel approval.");
    } finally {
      setCancellingApprovalId(null);
    }
  }

  function openApprovalForm() {
    setShowApprovalForm(true);
    if (services.length === 0) {
      void getActiveServices()
        .then(setServices)
        .catch((err: unknown) => Alert.alert("Error", err instanceof Error ? err.message : "Failed to load services."));
    }
  }

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

  function handleConfirmCashPayment() {
    if (!payment) return;
    Alert.alert("Confirm cash received?", "Marks this payment complete and issues the invoice.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setPaymentActionLoading(true);
          try {
            await confirmManualPayment(payment.id);
          } catch (err) {
            Alert.alert("Error", err instanceof Error ? err.message : "Failed to confirm payment.");
          } finally {
            setPaymentActionLoading(false);
          }
        },
      },
    ]);
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

      <Text style={sectionTitle}>Inspection</Text>
      <Section>
        {inspection ? (
          <>
            <Row label="Status" value={inspection.status === "finalized" ? "Finalized" : "In progress"} />
            <Button
              label={inspection.status === "finalized" ? "View inspection" : "Continue inspection"}
              variant="secondary"
              onPress={() => router.push(`/(tabs)/jobs/inspection/${job.id}`)}
            />
          </>
        ) : job.status === "CANCELLED" || job.status === "DELIVERED" ? (
          <Text style={{ ...typography.caption, color: colors.textMuted }}>No inspection was recorded for this job.</Text>
        ) : (
          <Button label="Start Inspection" onPress={() => void handleStartInspection()} loading={startingInspection} />
        )}
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
        {payment &&
          (payment.status === "pending" || payment.status === "processing") &&
          payment.method !== "razorpay_payment_link" && (
            <Button
              label="Confirm cash received"
              onPress={handleConfirmCashPayment}
              loading={paymentActionLoading}
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          )}
        {payment && payment.status === "pending" && payment.method === "razorpay_payment_link" && (
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            Awaiting online payment confirmation from the payment provider.
          </Text>
        )}
      </Section>

      <Text style={sectionTitle}>Approvals</Text>
      {approvals.length === 0 && !showApprovalForm && (
        <Section>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>No additional work requested.</Text>
        </Section>
      )}
      {approvals.map((a) => (
        <Section key={a.id}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>
                {a.serviceName}
                {a.quantity > 1 ? ` ×${a.quantity}` : ""}
              </Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>{a.reason}</Text>
              <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xxs }}>
                +{formatPaise(a.priceImpact)} · New total {formatPaise(a.newTotal)}
              </Text>
            </View>
            <StatusBadge label={APPROVAL_STATUS_LABELS[a.status] ?? a.status} tone={statusTone(a.status)} />
          </View>
          {a.status === "pending" && (
            <Button
              label="Cancel request"
              variant="ghost"
              size="md"
              loading={cancellingApprovalId === a.id}
              onPress={() => void handleCancelApproval(a.id)}
              style={{ marginTop: spacing.sm }}
            />
          )}
        </Section>
      ))}

      {job.status !== "DELIVERED" && job.status !== "CANCELLED" && (
        <>
          {!showApprovalForm ? (
            <Button
              label="Request Approval"
              variant="secondary"
              onPress={openApprovalForm}
              style={{ marginBottom: spacing.lg }}
            />
          ) : (
            <Section>
              <Text style={{ ...typography.captionMedium, color: colors.textSecondary, marginBottom: spacing.xs }}>
                Additional service
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.sm }}>
                {services.map((s) => {
                  const selected = selectedServiceId === s.id;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      onPress={() => setSelectedServiceId(s.id)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: selected ? colors.accent : colors.border,
                        backgroundColor: selected ? colors.accentMuted : colors.surface,
                      }}
                    >
                      <Text style={{ ...typography.caption, color: selected ? colors.accentPressed : colors.textPrimary }}>
                        {s.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TextInput
                label="Reason"
                placeholder="What did you find?"
                value={approvalReason}
                onChangeText={setApprovalReason}
                multiline
              />
              <Button
                label="Send for approval"
                onPress={() => void handleCreateApproval()}
                loading={creatingApproval}
                disabled={!selectedServiceId || !approvalReason.trim()}
              />
              <View style={{ height: spacing.sm }} />
              <Button
                label="Cancel"
                variant="ghost"
                onPress={() => {
                  setShowApprovalForm(false);
                  setSelectedServiceId(null);
                  setApprovalReason("");
                }}
              />
            </Section>
          )}
        </>
      )}

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
