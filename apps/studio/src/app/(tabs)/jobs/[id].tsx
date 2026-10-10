import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useState, useEffect } from "react";
import { Platform, View, Text, ScrollView, TouchableOpacity, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { updateStandby, advanceJobStatus, assignBay, getStudioConfig, getReslotOptions, reslotBooking, type ReslotOption } from "../../../lib/studio-service";
import {
  recordManualPayment,
  confirmManualPayment,
  listenToPaymentForJob,
  listenToInvoiceForJob,
} from "../../../lib/payment-service";
import { getCustomerMembership } from "../../../lib/membership-service";
import { createApproval, cancelApproval, listenToApprovalsForJob, getActiveServices } from "../../../lib/approval-service";
import { listenToInspection, startInspection } from "../../../lib/inspection-service";
import type { Vehicle, Customer, ServiceJob, StudioConfig, Payment, Invoice, Booking, Membership, ApprovalRequest, Service, Inspection } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import {
  colors,
  isNightPalette,
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
  STANDBY: "Arrived - standby",
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
  const [reslotOpen, setReslotOpen] = useState(false);
  const [reslotOptions, setReslotOptions] = useState<ReslotOption[]>([]);
  const [reslotLoading, setReslotLoading] = useState(false);
  const [reslotBusy, setReslotBusy] = useState(false);
  const [reslotError, setReslotError] = useState<string | null>(null);
  const [reslotPick, setReslotPick] = useState<ReslotOption | null>(null);
  const [reslotDone, setReslotDone] = useState(false);
  const [job, setJob] = useState<ServiceJob | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [startingInspection, setStartingInspection] = useState(false);
  const [vehicle,setVehicle] = useState<Vehicle|null>(null);
  const [customerName,setCustomerName] = useState<string|null>(null);
  const [serviceName,setServiceName] = useState<string|null>(null);
  const [requiredBayType, setRequiredBayType] = useState<string | null>(null);
  const [config, setConfig] = useState<StudioConfig | null>(null);
  const [feedError,setFeedError] = useState<string|null>(null);
  const [attempt,setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [reassignPick,setReassignPick] = useState<{id:string;name:string}|null>(null);
  const [actionError,setActionError] = useState<string|null>(null);
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
    if (!id) {setLoading(false);return;}
    setFeedError(null);setLoading(true);
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.jobs(), id),
      (snap) => {
        setFeedError(null);
        if (snap.exists()) {
          const j = snap.data() as ServiceJob;
          setJob(j);
          void getDoc(doc(db,COLLECTIONS.vehicles(),j.vehicleId)).then(s=>setVehicle(s.exists()?s.data() as Vehicle:null)).catch(()=>setVehicle(null));
          void getDoc(doc(db,COLLECTIONS.customers(),j.customerId)).then(s=>setCustomerName((s.data() as Customer|undefined)?.name??null)).catch(()=>setCustomerName(null));
          void getDoc(doc(db, COLLECTIONS.services(), j.serviceId)).then(s => { const data=s.data() as Service|undefined; setRequiredBayType(data?.requiredBayType??null);setServiceName(data?.name??null); }).catch(()=>setServiceName(null));
          if (!config) {
            void getStudioConfig(j.studioId).then(setConfig);
          }
        }
        setLoading(false);
      },
      (err) => {
        setFeedError(err.message);
        setLoading(false);
      },
    );
    return unsub;
  }, [id,attempt]);

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
    if (!job || startingInspection) return;
    setActionError(null);setStartingInspection(true);
    try {
      await startInspection(job.id);
      router.push(`/(tabs)/jobs/inspection/${job.id}`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start inspection.");
    } finally {
      setStartingInspection(false);
    }
  }

  async function handleCreateApproval() {
    if (!job || creatingApproval || !selectedServiceId || !approvalReason.trim()) return;
    setActionError(null);setCreatingApproval(true);
    try {
      await createApproval({ jobId: job.id, serviceId: selectedServiceId, reason: approvalReason.trim() });
      setShowApprovalForm(false);
      setSelectedServiceId(null);
      setApprovalReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to request approval.");
    } finally {
      setCreatingApproval(false);
    }
  }

  async function handleCancelApproval(approvalId: string) {
    if(cancellingApprovalId) return;
    setActionError(null);setCancellingApprovalId(approvalId);
    try {
      await cancelApproval(approvalId);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to cancel approval.");
    } finally {
      setCancellingApprovalId(null);
    }
  }

  function openApprovalForm() {
    setShowApprovalForm(true);
    if (services.length === 0) {
      void getActiveServices()
        .then(setServices)
        .catch((err: unknown) => setActionError(err instanceof Error ? err.message : "Failed to load services."));
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

  async function openReslot() {
    if (!job) return;
    setReslotOpen(true); setReslotLoading(true); setReslotError(null); setReslotPick(null); setReslotDone(false);
    try { setReslotOptions(await getReslotOptions(job)); }
    catch (err) { setReslotError(err instanceof Error ? err.message : "Could not load upcoming slots."); }
    finally { setReslotLoading(false); }
  }
  async function confirmReslot() {
    if (!job?.bookingId || !reslotPick) return;
    setReslotBusy(true); setReslotError(null);
    try { await reslotBooking(job.bookingId, reslotPick); setReslotOpen(false); setReslotPick(null); setReslotDone(true); }
    catch (err) { setReslotError(err instanceof Error ? err.message : "Could not reschedule. Reload the available times."); }
    finally { setReslotBusy(false); }
  }
  function slotLabel(slot: ReslotOption): string {
    return new Date(slot.startAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) + " IST";
  }

  const [staffAction, setStaffAction] = useState<"enqueue" | "admit" | "rework" | null>(null);
  const [advanceConfirm,setAdvanceConfirm] = useState(false);
  const [standbyBay, setStandbyBay] = useState("");
  async function performStaffAction() {
    if (!id || !staffAction || advancing) return;
    setActionError(null);setAdvancing(true);
    try {
      if (staffAction === "rework") await advanceJobStatus(id, "QC failed - rework requested", true);
      else await updateStandby(id, staffAction, staffAction === "admit" ? standbyBay : undefined);
      setStaffAction(null);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Could not update job."); }
    finally { setAdvancing(false); }
  }
  async function handleAdvance() {
    if (!job || !id || advancing) return;
    setActionError(null);setAdvancing(true);
    try {
      await advanceJobStatus(id);
      setAdvanceConfirm(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to advance status.");
    } finally {
      setAdvancing(false);
    }
  }

  async function handleReassignBay(bayId: string) {
    if (!job || !id || reassigning) return;
    setActionError(null);setReassigning(true);
    try {
      await assignBay({ jobId: id, bayId, reason: "Manual reassignment by studio" });
      setReassignPick(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reassign bay.");
    } finally {
      setReassigning(false);
    }
  }

  if(feedError) return <ErrorState title="Job unavailable" message={feedError} onRetry={()=>setAttempt(n=>n+1)}/>;
  if (loading) return <LoadingState />;
  if (!job) return <ErrorState title="Job not found" />;

  const transitions = JOB_STATUS_TRANSITIONS[job.status] ?? [];
  const canAdvance = job.status !== "STANDBY" && transitions.some((s) => s !== "CANCELLED");
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

  const isMultiDay = job.scheduledDate !== job.estimatedEndDate;
  const estimatedEndTime = new Date(job.estimatedEndAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const durationLabel =
    job.estimatedDurationMinutes < 24 * 60
      ? `~${job.estimatedDurationMinutes} min`
      : `~${Math.round(job.estimatedDurationMinutes / 60)} hrs of service time`;

  const compatibleBays = config?.bays.filter((b) => b.active && b.id !== job.bayId && b.bayType === requiredBayType) ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background, ...(NightPlatform.OS === "web" && nightMaterial ? nightGroundStyle : {}) }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, width:"100%",maxWidth:640,alignSelf:"center" }}>
      <View style={{ gap: spacing.sm, marginBottom: spacing.lg }}>
        <View style={{gap:spacing.xs}}><Text style={{...typography.title,color:colors.textPrimary}}>{vehicle?.registrationNumber??"Vehicle details"}</Text><Text style={{...typography.body,color:colors.textMuted}}>{vehicle?`${vehicle.make} ${vehicle.model}`:"Loading vehicle..."}{customerName?` · ${customerName}`:""}</Text></View>
      <StatusBadge label={statusLabel} tone={statusTone(job.status)} />
        {job.isWalkIn && <StatusBadge label="Walk-in" tone="accent" />}
      </View>

      <Section>
        <Row label="Bay" value={job.status === "STANDBY" ? "No bay reserved" : config?.bays.find(b=>b.id===job.bayId)?.name??"Loading bay..."} />
        <Row label="Service" value={serviceName??"Loading service..."} />
        <Row label="Scheduled" value={job.status === "STANDBY" ? "Waiting - no slot reserved" : scheduledTime} />
        <Row label="Duration" value={durationLabel} />
        <Row label="Expected ready" value={job.status === "STANDBY" ? "Set on admission" : estimatedEndTime} />
        <Row label="Payment" value={job.paymentStatus==="paid"?"Paid":job.paymentStatus==="unpaid"?"Unpaid":job.paymentStatus} />
      </Section>

      {actionError?<ErrorState title="Action not completed" message={actionError} fill={false}/>:null}
      {isMultiDay && (
        <View style={{ backgroundColor: colors.accentMuted, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg }}>
          <Text style={{ ...typography.bodyMedium, color: colors.accentPressed, marginBottom: spacing.xs }}>Multi-day job</Text>
          <Text style={{ ...typography.caption, color: colors.accentPressed }}>
            This job spans multiple days. The bay stays reserved from {job.scheduledDate} through {job.estimatedEndDate}.
          </Text>
        </View>
      )}

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
          {bookingMembership.membership.status === "active" ? (
            <Text style={{ ...typography.caption, color: colors.accentPressed, flexShrink: 1 }}>
              {bookingMembership.washUsed ? "Wash credit used" : bookingMembership.discountApplied ? "Membership discount applied" : "Member"}
            </Text>
          ) : (
            <Text style={{ ...typography.caption, color: colors.textMuted, flexShrink: 1 }}>
              Membership not active - no benefits apply yet
            </Text>
          )}
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
                        borderColor: selected ? colors.accent : colors.textMuted,
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

      {staffAction ? <Section>
        <Text style={{color: colors.textPrimary}}>{staffAction === "enqueue" ? "Mark arrived - standby? Releases the old bay reservation. No slot or service start is promised." : staffAction === "rework" ? "Send back to Work in progress for QC rework?" : "Admit at the actual time? Queue order, occupancy and upcoming reservations are checked before saving."}</Text>
        {staffAction === "admit" ? compatibleBays.map(b => <Button key={b.id} label={b.name} variant={standbyBay === b.id ? "primary" : "secondary"} onPress={() => setStandbyBay(b.id)} />) : null}
        <Button label="Confirm" disabled={staffAction === "admit" && !standbyBay} loading={advancing} onPress={() => void performStaffAction()} />
        <Button label="Cancel" variant="secondary" onPress={() => setStaffAction(null)} disabled={advancing} />
      </Section> : null}
      {job.status === "STANDBY" ? <Section><Text style={{color: colors.textPrimary}}>Waiting since {new Date(job.standbyArrivedAt ?? job.createdAt).toLocaleString("en-IN", {timeZone: "Asia/Kolkata"})}. No bay or time reserved.</Text><Button label="Admit from standby" onPress={() => setStaffAction("admit")} /></Section> : null}
      {job.status === "PENDING_VEHICLE" && job.bookingId ? <Button label="Arrived - standby" variant="secondary" disabled={Date.parse(job.scheduledAt) > Date.now()} onPress={() => setStaffAction("enqueue")} style={{marginBottom: spacing.lg}} /> : null}
      {job.status === "QUALITY_CHECK" ? <Button label="QC failed - send for rework" variant="secondary" onPress={() => setStaffAction("rework")} style={{marginBottom: spacing.lg}} /> : null}
      {advanceConfirm ? <Section><Text style={{color:colors.textPrimary}}>{advanceLabel}? This updates the studio floor and customer tracker.</Text><Button label={`Confirm ${advanceLabel.toLowerCase()}`} onPress={()=>void handleAdvance()} loading={advancing}/><Button label="Cancel" variant="secondary" disabled={advancing} onPress={()=>setAdvanceConfirm(false)}/></Section> : null}
      {job.status === "READY_FOR_DELIVERY" && job.paymentStatus !== "paid" ? <Text style={{color: colors.textPrimary, marginBottom: spacing.md}}>Collect and confirm full payment before marking delivered.</Text> : null}
      {canAdvance && (
        <Button label={advanceLabel} disabled={job.status === "READY_FOR_DELIVERY" && job.paymentStatus !== "paid"} onPress={() => setAdvanceConfirm(true)} loading={advancing} style={{ marginBottom: spacing.lg }} />
      )}

      {job.status === "PENDING_VEHICLE" && job.bookingId ? (
        <Section>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Reschedule booking</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>Customer arrived late? Move this booking into an upcoming available slot before checking in. The same booking and job are kept.</Text>
          {reslotDone ? <Text style={{ ...typography.caption, color: colors.textPrimary }}>Booking rescheduled. The new time is shown above.</Text> : null}
          {!reslotOpen ? <Button label="Reschedule" variant="secondary" onPress={() => void openReslot()} /> : (
            <View style={{ gap: spacing.sm }}>
              {reslotLoading ? <Text style={{ color: colors.textMuted }}>Loading upcoming slots...</Text> : null}
              {reslotError ? <Text accessibilityRole="alert" style={{ color: colors.textPrimary }}>{reslotError}</Text> : null}
              {!reslotLoading && !reslotError && reslotOptions.length === 0 ? <Text style={{ color: colors.textMuted }}>No upcoming slots in the next 14 days.</Text> : null}
              <ScrollView style={{ maxHeight: 260 }}>
                {reslotOptions.map(slot => <TouchableOpacity key={slot.startAt} disabled={reslotBusy} accessibilityRole="button" accessibilityState={{ selected: reslotPick?.startAt === slot.startAt }} onPress={() => setReslotPick(slot)} style={{ padding: spacing.md, marginBottom: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: reslotPick?.startAt === slot.startAt ? colors.accent : colors.textMuted }}><Text style={{ color: colors.textPrimary }}>{slotLabel(slot)}</Text></TouchableOpacity>)}
              </ScrollView>
              {reslotPick ? <><Text style={{ color: colors.textPrimary }}>Move this booking to {slotLabel(reslotPick)}? The studio will recheck bay capacity before saving.</Text><Button label="Confirm reschedule" onPress={() => void confirmReslot()} loading={reslotBusy} /></> : null}
              <Button label="Reload available times" variant="secondary" onPress={() => void openReslot()} disabled={reslotBusy || reslotLoading} />
              <Button label="Cancel" variant="secondary" onPress={() => { setReslotOpen(false); setReslotPick(null); }} disabled={reslotBusy} />
            </View>
          )}
        </Section>
      ) : null}

      {compatibleBays.length > 0 && job.status !== "STANDBY" && job.status !== "DELIVERED" && job.status !== "CANCELLED" && (
        <>
          <Text style={sectionTitle}>Reassign Bay</Text>
          {reassignPick?<Section><Text style={{color:colors.textPrimary}}>Move this job to {reassignPick.name}?</Text><Button label="Confirm bay change" loading={reassigning} onPress={()=>void handleReassignBay(reassignPick.id)}/><Button label="Keep current bay" variant="secondary" disabled={reassigning} onPress={()=>setReassignPick(null)}/></Section>:null}
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
                onPress={() => setReassignPick({id:bay.id,name:bay.name})}
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
    <View style={{ backgroundColor: isNightPalette ? "rgba(55,55,53,0.92)" : "rgba(255,255,255,0.8)", borderRadius: 22, borderWidth: 1, borderColor: isNightPalette ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.96)", padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm, ...(Platform.OS === "web" ? {backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", boxShadow: "0 8px 24px rgba(45,38,30,0.06)"} : {}) }}>
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
