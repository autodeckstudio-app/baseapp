import {ReleaseCompletedBayPane} from "../../../components/ReleaseCompletedBayPane";
import { httpsCallable } from "firebase/functions";
import { MEMBERSHIP_SETTLEMENT_ENABLED, ADMIN_APPROVAL_ENABLED, UPI_RECORD_ENABLED } from "../../../lib/backend-features";
import { AdminRequestPanel } from "../../../components/AdminRequestPanel";
import { canRecordPayment, payErrorNote, recordInput, type RecordMethod } from "../../../lib/record-payment-rules";
import { claimUpiPayment } from "../../../lib/payment-service";
import { RecordPaymentFields } from "../../../components/RecordPaymentFields";
import { membershipCoveredLabel } from "../../../lib/membership-covered-label";
import { isNightPalette as nightMaterial } from "@autodeck/ui";
import { Platform as NightPlatform } from "react-native";
import { nightGroundStyle, nightSurfaceStyle } from "@autodeck/ui/theme";
import { useState, useEffect, useRef } from "react";
import { Platform, View, Text, ScrollView, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db, functions } from "../../../lib/firebase";
import { updateStandby, advanceJobStatus, cancelWalkinJob, assignBay, getStudioConfig, getReslotOptions, reslotBooking, onStaffAuthChanged, staffAuthFingerprint, type ReslotOption, type StaffAuth } from "../../../lib/studio-service";
import { DeliveryConfirmPane } from "../../../components/DeliveryConfirmPane";
import {
  recordManualPayment,
  confirmManualPayment,
  listenToPaymentForJob,
  listenToInvoiceForJob,
} from "../../../lib/payment-service";
import { getCustomerMembership } from "../../../lib/membership-service";
import { approvalSendButton, pendingApprovalNote } from "../../../lib/approval-send";
import { createApproval, cancelApproval, listenToApprovalsForJob, getActiveServices } from "../../../lib/approval-service";
import { listenToInspection, startInspection } from "../../../lib/inspection-service";
import type { Vehicle, Customer, ServiceJob, StudioConfig, Payment, Invoice, Booking, Membership, ApprovalRequest, Service, Inspection } from "@autodeck/core";
import { JOB_STATUS_TRANSITIONS, formatDuration } from "@autodeck/core";
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
  PENDING_VEHICLE: "Car arrived, start work",
  VEHICLE_RECEIVED: "Start Work",
  IN_PROGRESS: "Done, ready for handover",
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
  const [bookingSnap, setBookingSnap] = useState<{key:string;read:"ready"|"error";record:Booking|null}|null>(null);
  const [bookingRetry,setBookingRetry]=useState(0);
  const bookingKey=job?`${job.tenantId}|${job.id}|${job.bookingId??""}|${bookingRetry}`:"";
  const booking=bookingSnap?.key===bookingKey?bookingSnap.record:null;
  const bookingRead=bookingSnap?.key===bookingKey?bookingSnap.read:"loading";
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
  const [paymentRetryTick, setPaymentRetryTick] = useState(0);
  // ReadSnapshot: the payment read state TOGETHER WITH the exact scope that
  // produced it (job id + tenant + retry generation + subscription epoch).
  // Ambient "ready/null" authenticates nothing: a render under a changed
  // job/tenant/retry sees the old snapshot's scope no longer matches and
  // treats the read as still loading - synchronously, before any effect.
  type ReadSnap = { jobId: string; tenantId: string; retry: number; epoch: number; read: "ready" | "error"; record: Payment | null };
  const [paySnap, setPaySnap] = useState<ReadSnap | null>(null);
  // Monotonic epoch for the payment listener: a late callback from an older
  // subscription (pre-retry, pre-route, pre-tenant-change) must never write
  // into the current read state. Mirrors the advanceConfirm epoch pattern.
  const paymentEpoch = useRef(0);
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
  const [approvalSent, setApprovalSent] = useState(false);
  const [approvalsBefore, setApprovalsBefore] = useState(0);

  useEffect(() => {
    if (!id) {setLoading(false);return;}
    // Route change: clear the previous job and any open confirm pane FIRST -
    // until this route's listener delivers, nothing from the old job may
    // stay on screen (a delivery declaration is about exactly one job).
    setJob(null);setVehicle(null);setCustomerName(null);setServiceName(null);setConfig(null);setAdvanceConfirm(null);setStaffAction(null);
    setFeedError(null);setLoading(true);
    let alive=true;
    const unsub = onSnapshot(
      doc(db, COLLECTIONS.jobs(), id),
      (snap) => {
        if(!alive)return;
        setFeedError(null);
        if (snap.exists()) {
          const j = snap.data() as ServiceJob;
          setJob(j);
          void getDoc(doc(db,COLLECTIONS.vehicles(),j.vehicleId)).then(s=>alive&&setVehicle(s.exists()?s.data() as Vehicle:null)).catch(()=>{if(alive)setVehicle(null)});
          void getDoc(doc(db,COLLECTIONS.customers(),j.customerId)).then(s=>alive&&setCustomerName((s.data() as Customer|undefined)?.name??null)).catch(()=>{if(alive)setCustomerName(null)});
          void getDoc(doc(db, COLLECTIONS.services(), j.serviceId)).then(s => { if(!alive)return;const data=s.data() as Service|undefined; setRequiredBayType(data?.requiredBayType??null);setServiceName(data?.name??null); }).catch(()=>{if(alive)setServiceName(null)});
          if (!config) {
            void getStudioConfig(j.studioId).then(c=>{if(alive)setConfig(c)});
          }
        }
        setLoading(false);
      },
      (err) => {
        setFeedError(err.message);
        setLoading(false);
      },
    );
    return()=>{alive=false;unsub()};
  }, [id,attempt]);

  // A live stage change under an open advance confirm must RESET it: the
  // confirm was affirmed for the stage it named, and a stage move never
  // transforms it into a different action's confirm.
  useEffect(() => { setAdvanceConfirm(null); }, [job?.status]);

  useEffect(() => {
    if (!job) {
      paymentEpoch.current += 1;
      setPaySnap(null);
      setInvoice(null);
      return;
    }
    const jobId = job.id;
    const tenantId = job.tenantId;
    const retry = paymentRetryTick;
    const epoch = ++paymentEpoch.current;
    // Restarting the subscription invalidates the previous snapshot: never
    // let the old scope's (or an older attempt's) read survive into this one.
    setPaySnap(null);
    const unsubPayment = listenToPaymentForJob(jobId, tenantId,
      (rec) => { if (paymentEpoch.current !== epoch) return; setPaySnap({ jobId, tenantId, retry, epoch, read: "ready", record: rec }); },
      () => { if (paymentEpoch.current !== epoch) return; setPaySnap({ jobId, tenantId, retry, epoch, read: "error", record: null }); });
    const unsubInvoice = listenToInvoiceForJob(jobId, tenantId,
      (inv) => { if (paymentEpoch.current !== epoch) return; setInvoice(inv); },
      () => undefined);
    return () => {
      // Retire the epoch BEFORE unsubscribing: a late callback racing the
      // teardown (or firing after unmount) finds a dead epoch and drops its
      // delivery instead of publishing into the next subscription or a
      // mounted-new screen.
      paymentEpoch.current += 1;
      unsubPayment();
      unsubInvoice();
    };
  }, [job?.id, job?.tenantId, paymentRetryTick]);

  // Live booking for this job: drives the covered-settlement gate and label.
  useEffect(() => {
    if (!job?.bookingId) return;
    let active=true;const key=bookingKey;
    const unsub=onSnapshot(doc(db, COLLECTIONS.bookings(), job.bookingId), snap => {if(active)setBookingSnap({key,read:"ready",record:snap.exists()?snap.data() as Booking:null});},()=>{if(active)setBookingSnap({key,read:"error",record:null});});
    return()=>{active=false;unsub();};
  }, [bookingKey]);

  // Read-only membership status for this job's booking (if any) — studio can
  // see it but has no authority to alter it (doc08 §8.2).
  useEffect(() => {
    if (!job?.bookingId) {
      setBookingMembership(null);
      return;
    }
    void (async () => {
      const freshBookingSnap = await getDoc(doc(db, COLLECTIONS.bookings(), job.bookingId as string));
      if (!freshBookingSnap.exists()) return;
      const membershipBooking = freshBookingSnap.data() as Booking;
      if (!membershipBooking.membershipId) return;
      const membership = await getCustomerMembership(job.customerId, membershipBooking.membershipId);
      if (membership) {
        setBookingMembership({
          membership,
          washUsed: membershipBooking.membershipWashUsed,
          discountApplied: membershipBooking.membershipDiscountApplied,
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
    setActionError(null);setApprovalsBefore(approvals.length);setApprovalSent(false);setCreatingApproval(true);
    try {
      await createApproval({ jobId: job.id, serviceId: selectedServiceId, reason: approvalReason.trim() });
      setApprovalSent(true);
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

  const payBusyRef = useRef(false);
  // Identity-bound payment confirmation: the panel captures a FROZEN target
  // at open (mode + job id + tenant + payment id + read epoch). A same-job
  // record swap (p1 -> p2), a tenant/route change, a retry, or a status/
  // method flip can never retarget an armed panel - the binding is compared
  // synchronously against the current render context AND re-checked against
  // the latest-state ref inside the handler before any mutation.
  const [advanceAuth, setAdvanceAuth] = useState<StaffAuth | null | undefined>(undefined);
  useEffect(() => onStaffAuthChanged(setAdvanceAuth), []);
  type CashBinding = { mode: "record" | "confirm"; armId: number; jobId: string; tenantId: string; paymentId: string | null; epoch: number; gen: number };
  // Monotonic arm identity: every click arms a NEW id, even for the same
  // record. A retained callback from an older arm can never match the
  // currently armed identity.
  const payArmSeq = useRef(0);
  const [cashConfirm, setCashConfirm] = useState<CashBinding | null>(null);
  const [cashError, setCashError] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState<RecordMethod>("cash");
  const [payVerified, setPayVerified] = useState(false);
  const [payRef, setPayRef] = useState("");

  // Latest-state ref: updated synchronously during render so the mutation
  // handler checks CURRENT state, never a stale render closure.
  // The read state is ONLY the snapshot whose producing scope exactly matches
  // the current render's expected scope (job id + tenant + retry + live
  // subscription epoch). Anything else - including a one-render window before
  // the resubscribe effect lands - is "loading", never the old scope's ready.
  const snapLive = paySnap !== null && job !== null
    && paySnap.jobId === job.id && paySnap.tenantId === job.tenantId
    && paySnap.retry === paymentRetryTick && paySnap.epoch === paymentEpoch.current
    ? paySnap : null;
  const payment: Payment | null = snapLive?.record ?? null;
  const paymentRead: "loading" | "ready" | "error" = snapLive?.read ?? "loading";

  const payLatestRef = useRef<{ job: ServiceJob | null; payment: Payment | null; read: "loading" | "ready" | "error"; epoch: number }>({ job: null, payment: null, read: "loading", epoch: 0 });
  payLatestRef.current = { job, payment, read: paymentRead, epoch: paymentEpoch.current };
  // The CURRENTLY armed binding, updated synchronously at render: a handler
  // invoked through a retained callback (post-Cancel, post-kill, post-unmount)
  // must never act on the binding its own render closure captured.
  const payBindingRef = useRef<CashBinding | null>(null);
  payBindingRef.current = cashConfirm;

  // Mounted/live flag: false before mount effects run and after unmount.
  const payMountedRef = useRef(false);
  useEffect(() => { payMountedRef.current = true; return () => { payMountedRef.current = false; }; }, []);

  // Scope generation: a synchronous, render-time counter that bumps whenever
  // ANY value that could authenticate a payment binding changes - job id,
  // tenant, retry generation, read state, the record's identity/status/
  // method, the job's paid flag and stage. An A -> B -> A round-trip mints a
  // NEW generation, so a binding killed by any mismatch is dead permanently:
  // returning to the old values can never revive it; a fresh click binds a
  // fresh generation. The read state (including ready/null) is only valid
  // under the exact scope that produced it - an unscoped null authenticates
  // nothing.
  const payScopeKey = `${staffAuthFingerprint(advanceAuth)}|${job?.id ?? "none"}|${job?.tenantId ?? ""}|${paymentRetryTick}|${paymentRead}|${payment?.id ?? "null"}|${payment?.status ?? ""}|${payment?.method ?? ""}|${job?.paymentStatus ?? ""}|${job?.status ?? ""}`;
  const payGenRef = useRef({ n: 0, key: "" });
  if (payGenRef.current.key !== payScopeKey) { payGenRef.current = { n: payGenRef.current.n + 1, key: payScopeKey }; }
  const payGen = payGenRef.current.n;

  // Synchronous binding check, evaluated at render: an invalid binding never
  // reaches the screen, even on the render before any effect could run.
  function cashBindingLive(b: CashBinding | null, j: ServiceJob | null, pay: Payment | null, read: "loading" | "ready" | "error", epoch: number, gen: number): b is CashBinding {
    if (!b || !j) return false;
    // Generation equality subsumes every scope input: any change (including
    // an A -> B -> A return) has minted a new generation.
    if (b.gen !== gen) return false;
    if (b.jobId !== j.id || b.tenantId !== j.tenantId || b.epoch !== epoch) return false;
    if (read !== "ready" || j.status === "CANCELLED" || j.paymentStatus === "paid") return false;
    if (b.mode === "record") return pay === null || (pay.method === "cash" && ["failed","cancelled"].includes(pay.status));
    return pay !== null
      && pay.id === b.paymentId
      && pay.jobId === j.id
      && pay.tenantId === j.tenantId
      && (pay.status === "pending" || pay.status === "processing")
      && pay.method === "cash";
  }
  const cashConfirmLive = cashBindingLive(cashConfirm, job, payment, paymentRead, paymentEpoch.current, payGen);


  function handleRecordCashPayment() {
    if(job?.bookingId&&(!booking||booking.priceOnRequest===true&&booking.quoteStatus!=="approved"))return;
    if (!job?.id||!advanceAuth||advanceAuth.tenantId!==job.tenantId||!["studio","admin","superadmin"].includes(advanceAuth.role??"")||(advanceAuth.role==="studio"&&advanceAuth.studioId!==job.studioId)) return;
    setCashError(null); setPayMethod("cash"); setPayVerified(false); setPayRef("");
    setCashConfirm({ mode: "record", armId: ++payArmSeq.current, jobId: job.id, tenantId: job.tenantId, paymentId: null, epoch: paymentEpoch.current, gen: payGen });
  }

  function handleConfirmCashPayment() {
    if (!job || !payment) return;
    setCashError(null);
    setCashConfirm({ mode: "confirm", armId: ++payArmSeq.current, jobId: job.id, tenantId: job.tenantId, paymentId: payment.id, epoch: paymentEpoch.current, gen: payGen });
  }

  async function performCashAction(armedId: number) {
    // Immutable affirmation identity: the onPress captured its arm's id at
    // render. A retained callback from an older arm - after Cancel, after a
    // kill, after a fresh arm of ANY record including the same one - names a
    // different id than the currently armed binding and stops here.
    const binding = payBindingRef.current;
    if (!binding || binding.armId !== armedId) return;
    const mode = binding.mode;
    const jobId = binding.jobId;
    if (paymentActionLoading || payBusyRef.current) return;
    // Revalidate against CURRENT state before any mutation: the panel may
    // have been armed against a record/job that has since changed. Never
    // record or confirm against a stale record, a cancelled job, or a job
    // already marked paid.
    if (!payMountedRef.current) { setCashConfirm(null); return; }
    const cur = payLatestRef.current;
    // Live epoch, not a saved value: a retained callback after Cancel sees no
    // binding, and after unmount this handler has already returned above.
    if (!cashBindingLive(binding, cur.job, cur.payment, cur.read, paymentEpoch.current, payGenRef.current.n)) { setCashConfirm(null); return; }
    payBusyRef.current = true;
    setPaymentActionLoading(true); setCashError(null);
    try {
      if (mode === "record") { if (!jobId) return; { if (UPI_RECORD_ENABLED) { if (payMethod === "upi_manual") { await claimUpiPayment(jobId); } else { const bad = canRecordPayment({ method: payMethod, verified: payVerified, reference: payRef }); if (bad) { setCashError(bad); return; } await recordManualPayment(recordInput(jobId, { method: payMethod, reference: payRef })); } } else await recordManualPayment({ jobId, method: "cash" }); } }
      else if (binding.paymentId) await confirmManualPayment(binding.paymentId);
      setCashConfirm(null);
    } catch (err) {
      setCashError(payErrorNote(err, mode));
    } finally {
      payBusyRef.current = false;
      setPaymentActionLoading(false);
    }
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
  // The armed advance confirm is an IDENTITY TOKEN, not a flag: it names the
  // job, the stage and the operator it was affirmed for. The confirm UI below
  // renders ONLY while all three still match - synchronously, at render time -
  // so a route move, a live stage flip or an account switch can never let an
  // old affirmation ride onto a different action (not even for one render).
  const [advanceConfirm,setAdvanceConfirm] = useState<{ route: string; jobId: string; status: string; epoch: number } | null>(null);

  // Monotonic operator-scope epoch: bumps on EVERY verified-fingerprint
  // change, either direction - including a same-uid re-scope (A -> B -> A) -
  // so an affirmation armed under an earlier scope can NEVER revive. The
  // fingerprint binds uid + role + tenant + studio, not the uid alone.
  const advanceFpPrev = useRef<string | undefined>(undefined);
  const advanceEpoch = useRef(0);
  const advanceFp = staffAuthFingerprint(advanceAuth);
  if (advanceFpPrev.current !== advanceFp) { advanceFpPrev.current = advanceFp; advanceEpoch.current += 1; }
  // Kill a stale armed confirmation BEFORE the loading/error/not-found early
  // returns below can skip the check: wrong route, superseded operator-scope
  // epoch, or a live job/status move - including a terminal round-trip such
  // as READY -> DELIVERED -> READY after a correction - disarms it on THIS
  // render, not one effect later.
  if (advanceConfirm && (advanceConfirm.route !== (id ?? "") || advanceConfirm.epoch !== advanceEpoch.current || (job !== null && (advanceConfirm.jobId !== job.id || advanceConfirm.status !== job.status)))) {
    setAdvanceConfirm(null);
  }
  const [standbyBay, setStandbyBay] = useState("");
  async function performStaffAction() {
    if (!id || !staffAction || advancing) return;
    setActionError(null);setAdvancing(true);
    try {
      if (staffAction === "rework") await advanceJobStatus(id, "Sent back for rework", true);
      else await updateStandby(id, staffAction, staffAction === "admit" ? standbyBay : undefined);
      setStaffAction(null);
    } catch (err) { setActionError(err instanceof Error ? err.message : "Could not update job."); }
    finally { setAdvancing(false); }
  }
  async function handleAdvance() {
    if (!job || !id || advancing) return;
    setActionError(null);setAdvancing(true);
    try {
      const steps = job.status === "PENDING_VEHICLE" || job.status === "IN_PROGRESS" ? 2 : 1;
      for (let i = 0; i < steps; i++) await advanceJobStatus(id);
      setAdvanceConfirm(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to advance status.");
    } finally {
      setAdvancing(false);
    }
  }

  const [cancelConfirm, setCancelConfirm] = useState(false);
  async function handleCancelWalkin() {
    if (!job || !id || advancing) return;
    setActionError(null); setAdvancing(true);
    try { await cancelWalkinJob(id, "Walk-in started by mistake"); setCancelConfirm(false); }
    catch (err) { setActionError(err instanceof Error ? err.message : "Could not cancel this walk-in."); }
    finally { setAdvancing(false); }
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
  const quotePaymentHold=Boolean(job.bookingId)&&(!booking||booking.priceOnRequest===true&&booking.quoteStatus!=='approved');
  const quoteWorkHold=job.status==='VEHICLE_RECEIVED'&&Boolean(job.bookingId)&&(!booking||booking.priceOnRequest===true&&booking.quoteStatus!=='approved');
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

  const paymentReview=(payment as (Payment & {invoiceReviewNeeded?:boolean})|null)?.invoiceReviewNeeded===true;
  const paymentSyncing=paymentRead==='ready'&&!paymentReview&&((payment?.status==='completed'&&job.paymentStatus!=='paid')||(job.paymentStatus==='paid'&&payment?.status!=='completed'));
  const unifiedPaymentLabel=!payment&&paymentRead==='ready'?(job.paymentStatus==='paid'?'No payment record found':'Not yet initiated'):paymentReview?'Received - needs office review':paymentSyncing?'Payment records syncing - do not collect again':job.paymentStatus==='paid'?'Paid':payment?.status==='completed'?'Checking payment status':payment?PAYMENT_STATUS_LABELS[payment.status]??payment.status:job.paymentStatus==='unpaid'?'Unpaid':job.paymentStatus;
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
      ? `~${formatDuration(job.estimatedDurationMinutes)}`
      : `~${Math.round(job.estimatedDurationMinutes / 60)} hrs of service time`;

  const compatibleBays = config?.bays.filter((b) => b.active && b.id !== job.bayId && b.bayType === requiredBayType) ?? [];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "transparent" }} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 130, width:"100%",maxWidth: 1040,alignSelf:"center" }}>
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
        <Row label="Payment" value={membershipCoveredLabel(job) ?? (booking ? membershipCoveredLabel(booking) : null) ?? unifiedPaymentLabel} />
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

      <Text style={sectionTitle}>Job stage history</Text>
      <Section>
        {job.statusHistory.map((entry, i) => (
          <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...typography.caption, color: colors.textPrimary }}>{JOB_STATUS_LABELS[entry.status] ?? entry.status}</Text>
            <Text style={{ ...typography.caption, color: colors.textMuted }}>{formatTime(entry.changedAt)}</Text>
          </View>
        ))}
      </Section>

      <Text style={sectionTitle}>Photos and damage note (optional)</Text>
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
          <Text style={{ ...typography.caption, color: colors.textMuted }}>No photos or damage note were recorded.</Text>
        ) : (
          <Button label="Add photos or a damage note" onPress={() => void handleStartInspection()} loading={startingInspection} />
        )}
      </Section>

      {MEMBERSHIP_SETTLEMENT_ENABLED && booking?.membershipWashUsed && booking.totalAmount === 0 && job.totalAmount === 0 && !(job as { settlementKind?: string }).settlementKind && job.status !== "CANCELLED" && !["CANCELLED","EXPIRED"].includes(booking.status) ? <Section>
        <Text style={{color:colors.textPrimary}}>Membership-covered, not yet settled</Text>
        <Button label="Settle membership-covered visit" loading={paymentActionLoading} onPress={()=>{setPaymentActionLoading(true);setActionError(null);void httpsCallable(functions,"settleMembershipCoveredJob")({jobId:job.id}).catch(e=>setActionError(e instanceof Error?e.message:"Could not settle this visit.")).finally(()=>setPaymentActionLoading(false));}} />
      </Section> : null}
      <Text style={sectionTitle}>Payment</Text>
      <Section>
        <Row label="Status" value={membershipCoveredLabel(job) ?? (booking ? membershipCoveredLabel(booking) : null) ?? (paymentRead === "loading" ? "Checking payment status..." : paymentRead === "error" ? "Payment status unavailable" : unifiedPaymentLabel)} />
        {paymentRead === "error" && (
          <>
            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
              The payment record could not be loaded. Do not record or collect a payment until the real status loads - the job may already be paid.
            </Text>
            <Button label="Retry payment status" size="md" variant="secondary" style={{ marginTop: spacing.xs }} onPress={() => setPaymentRetryTick((t) => t + 1)} />
          </>
        )}
        {paymentRead === "ready" && !payment && job.paymentStatus === "paid" && (
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            This job is marked paid, but no payment record was found. Do not collect again - ask the office to reconcile the payment record.
          </Text>
        )}
        {(payment as (Payment & {invoiceReviewNeeded?:boolean})|null)?.invoiceReviewNeeded ? <Text style={{color:colors.textMuted}}>Money received, but this payment needs office review. The job is not marked paid. Do not collect another payment.</Text> : null}
        {payment?.method === "cash" && ["failed","cancelled"].includes(payment.status) ? <Text style={{color:colors.textMuted}}>The previous recording attempt did not complete. Check whether cash is already in hand before recording it. Do not collect it again.</Text> : null}
        <Row label="Job total" value={formatPaise(job.totalAmount)} />
        {payment ? <Row label="Method" value={payment.method === "cash" ? "Cash" : payment.method === "razorpay_payment_link" ? "Online payment link" : payment.method === "upi_manual" ? "UPI - office confirmation" : "Bank transfer - office confirmation"} /> : null}
        {invoice && <Row label="Invoice" value={invoice.invoiceNumber} />}
        {paymentRead === "ready" && payment?.method === "razorpay_payment_link" && ["pending","processing"].includes(payment.status)?<Button label="Refresh recorded payment status" size="md" variant="secondary" onPress={()=>setPaymentRetryTick(t=>t+1)}/>:null}

        {!(MEMBERSHIP_SETTLEMENT_ENABLED && (membershipCoveredLabel(job) || (booking && membershipCoveredLabel(booking)))) && !cashConfirmLive && paymentRead === "ready" && (!payment || (payment.method === "cash" && ["failed","cancelled"].includes(payment.status))) && job.paymentStatus !== "paid" && job.status !== "CANCELLED" && (
          <Button
            label={UPI_RECORD_ENABLED ? "Record payment" : "Record cash payment"}
            disabled={quotePaymentHold}
            onPress={() => void handleRecordCashPayment()}
            loading={paymentActionLoading}
            size="md"
            style={{ marginTop: spacing.xs }}
          />
        )}
        {!cashConfirmLive && paymentRead === "ready" && payment &&
          payment.jobId === job.id &&
          payment.tenantId === job.tenantId &&
          job.paymentStatus !== "paid" &&
          (payment.status === "pending" || payment.status === "processing") &&
          payment.method === "cash" && (
            <Button
              label="Confirm cash received"
              onPress={handleConfirmCashPayment}
              loading={paymentActionLoading}
              size="md"
              style={{ marginTop: spacing.xs }}
            />
          )}
        {paymentRead === "ready" && payment &&
          payment.jobId === job.id &&
          (payment.status === "pending" || payment.status === "processing") &&
          payment.method !== "cash" &&
          payment.method !== "razorpay_payment_link" && (
            <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
              UPI payment claimed. Waiting for the office to check the account and confirm.
            </Text>
          )}
        {paymentRead === "ready" && payment && payment.jobId === job.id && payment.status === "pending" && payment.method === "razorpay_payment_link" && (
          <Text style={{ ...typography.caption, color: colors.textMuted, marginTop: spacing.xs }}>
            Payment link pending. No payment is confirmed in AutoDeck yet. Counter collection is on hold. A safe switch is not available here yet; do not collect a second payment.
          </Text>
        )}
      {cashConfirm && cashConfirmLive ? <View style={{marginTop:spacing.md,gap:spacing.sm}}>
        {UPI_RECORD_ENABLED && cashConfirm.mode === "record" && job ? <RecordPaymentFields totalPaise={job.totalAmount} method={payMethod} onMethod={setPayMethod} verified={payVerified} onVerified={setPayVerified} reference={payRef} onReference={setPayRef} /> : null}

        <Text style={{color: colors.textPrimary}}>{cashConfirm.mode === "record" ? (UPI_RECORD_ENABLED && payMethod === "upi_manual" ? "Payment claimed? Sends the full amount to the office to check the account and mark paid. The job stays unpaid until then." : "Record cash payment? Confirms the customer paid in full at the studio.") : "Confirm cash received? Marks this payment complete and issues the invoice."}</Text>
        {cashError ? <Text accessibilityRole="alert" style={{color: colors.textPrimary}}>{cashError}</Text> : null}
        <Button label="Confirm" onPress={() => void performCashAction(cashConfirm.armId)} loading={paymentActionLoading} />
        <Button label="Cancel" variant="secondary" disabled={paymentActionLoading} onPress={() => { setCashConfirm(null); setCashError(null); }} />
      </View> : null}
      </Section>

      <Text style={sectionTitle}>Approvals</Text>
      {pendingApprovalNote(creatingApproval ? "sending" : approvalSent ? "sent" : "idle", approvals.length, approvalsBefore) ? (
        <Section>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{pendingApprovalNote(creatingApproval ? "sending" : approvalSent ? "sent" : "idle", approvals.length, approvalsBefore)}</Text>
        </Section>
      ) : null}
      {approvals.length === 0 && !showApprovalForm && !creatingApproval && !approvalSent && (
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
                label={approvalSendButton(creatingApproval ? "sending" : "idle", !!selectedServiceId && !!approvalReason.trim()).label}
                onPress={() => void handleCreateApproval()}
                loading={creatingApproval}
                disabled={approvalSendButton(creatingApproval ? "sending" : "idle", !!selectedServiceId && !!approvalReason.trim()).disabled}
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
      {job.status === "QUALITY_CHECK" ? <Button label="Send back for rework" variant="ghost" onPress={() => setStaffAction("rework")} style={{marginBottom: spacing.lg}} /> : null}
      {ADMIN_APPROVAL_ENABLED && job ? <AdminRequestPanel targetType="job" targetId={job.id} tenantId={job.tenantId} studioId={job.studioId} /> : null}
      {advanceConfirm && job ? <Section>{job.status === "READY_FOR_DELIVERY" ? <DeliveryConfirmPane key={`${job.id}:${job.vehicleId}`} job={job} onDelivered={()=>setAdvanceConfirm(null)} onCancel={()=>setAdvanceConfirm(null)}/> : <><Text style={{color:colors.textPrimary}}>{advanceLabel}? This updates the studio floor and customer tracker.</Text><Button label={`Confirm ${advanceLabel.toLowerCase()}`} onPress={()=>void handleAdvance()} loading={advancing}/><Button label="Cancel" variant="secondary" disabled={advancing} onPress={()=>setAdvanceConfirm(null)}/></>}</Section> : null}
      {job.status === "READY_FOR_DELIVERY" ? <Section><ReleaseCompletedBayPane key={`${job.id}:${job.status}:${job.bayReleasedAt??''}`} job={job}/></Section> : null}
      {job.status === "READY_FOR_DELIVERY" && job.paymentStatus !== "paid" ? <Text style={{color: colors.textPrimary, marginBottom: spacing.md}}>{MEMBERSHIP_SETTLEMENT_ENABLED && booking?.membershipWashUsed && job.totalAmount === 0 ? "Settle the membership-covered visit before marking delivered." : "Collect and confirm full payment before marking delivered."}</Text> : null}
      {/* While a confirmation is open the original advance control stays
          hidden: only the confirmation's Confirm/Cancel may act - no second
          arm/reset path competing with it. */}
      {canAdvance && !advanceConfirm ? (
        <>{quoteWorkHold?<View style={{marginBottom:spacing.sm}}><Text style={{color:colors.textSecondary}}>{bookingRead==='loading'?'Checking linked booking before work and payment.':!booking?'Linked booking unavailable. Retry before work or payment.':'Waiting for customer price approval before work and payment.'}</Text>{bookingRead!=='loading'&&!booking?<Button label="Retry linked booking" size="md" variant="secondary" onPress={()=>setBookingRetry(n=>n+1)}/>:null}</View>:null}<Button label={advanceLabel} variant={job.status === "READY_FOR_DELIVERY" ? "secondary" : "primary"} disabled={quoteWorkHold||(job.status === "READY_FOR_DELIVERY" && job.paymentStatus !== "paid")} onPress={() => (job.status === "READY_FOR_DELIVERY" ? setAdvanceConfirm({ route: id ?? "", jobId: job.id, status: job.status, epoch: advanceEpoch.current }) : void handleAdvance())} loading={advancing} style={{ marginBottom: spacing.lg }} /></>
      ) : null}

      {job.status === "PENDING_VEHICLE" && job.bookingId ? (
        <Section>
          <Text style={{ ...typography.bodyMedium, color: colors.textPrimary }}>Reschedule booking</Text>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>Late arrival? Move this booking to an upcoming slot before check-in. Same booking and job kept.</Text>
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

      {job.isWalkIn && job.status === "VEHICLE_RECEIVED" && job.paymentStatus === "unpaid" ? (
        cancelConfirm
          ? <Section><Text style={{color:colors.textPrimary}}>Cancel this walk-in? It was started by mistake. The bay is freed and nothing is charged.</Text><Button label="Confirm cancel" onPress={()=>void handleCancelWalkin()} loading={advancing}/><Button label="Keep walk-in" variant="secondary" disabled={advancing} onPress={()=>setCancelConfirm(false)}/></Section>
          : <Button label="Cancel walk-in" variant="secondary" onPress={()=>setCancelConfirm(true)} style={{marginBottom: spacing.lg}} />
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
    <View style={{ backgroundColor: isNightPalette ? "rgba(55,55,53,0.92)" : "rgba(255,255,255,0.8)", borderRadius: 20, borderWidth: 1, borderColor: isNightPalette ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.96)", padding: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm, ...(Platform.OS === "web" ? {backdropFilter: "blur(22px) saturate(140%)", WebkitBackdropFilter: "blur(22px) saturate(140%)", boxShadow: "0 8px 24px rgba(45,38,30,0.06)"} : {}) }}>
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
