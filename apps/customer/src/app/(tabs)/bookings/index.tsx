import { metrics } from "../../../lib/metrics";
import { bookingSections } from "../../../lib/booking-sections";
import { useExperienceTheme } from "@autodeck/ui/native";
// Bookings: what's coming first, then history.
import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { isBookingMissed, type Booking } from "@autodeck/core";
import { formatDateShort } from "@autodeck/ui";
import { space } from "@autodeck/ui/theme";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { getServiceCatalogue } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import type { Service, Vehicle } from "@autodeck/core";
import { getMyBookings } from "../../../lib/booking-service";

import { listenToMyJobs, bookingFromJob } from "../../../lib/job-service";
import { VisitCard } from "../../../ui/VisitCard";
import { CarThumb } from "../../../ui/CarThumb";
import { NextVisitHero } from "../../../ui/NextVisitHero";
import { sceneImagery } from "../../../lib/imagery";
import type { ApprovalRequest, ServiceJob } from "@autodeck/core";
import { listenToApprovalsForJob } from "../../../lib/approval-service";
import { cancelBooking } from "../../../lib/booking-service";
import { getRescheduleEligibility, cancelState } from "../../../lib/booking-rules";
import { liveJobOf, recentDistinctServices, groupByMonth } from "../../../lib/bookings-view";
import { STUDIO_INFO } from "../../../lib/studio-info";
import { jobStage, readyIsAhead, STAGES } from "../../../ui/job-stage";
import { TabPills } from "../../../ui/CarOverview";
import { loadServiceNames, missingNameIds } from "../../../lib/service-names";
import { listenToMyInvoices } from "../../../lib/invoice-service";
import { visitServices, visitTitle, visitAlso } from "../../../lib/visit-services";
import type { Invoice } from "@autodeck/core";
import { glassInner } from "../../../lib/glass";
import { HeroImage, Button, CanvasTitle, Chip, Kicker, Loading, Notice, PageHeader, Pane, Screen, SectionTitle, T, rupees } from "../../../ui/kit";

const STATUS: Record<Booking["status"], { label: string; tone: "accent" | "premium" | "neutral" | "danger" }> = {
  PENDING: { label: "Awaiting confirm", tone: "accent" },
  CONFIRMED: { label: "Confirmed", tone: "premium" },
  ACTIVE: { label: "In the studio", tone: "accent" },
  COMPLETED: { label: "Done", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "neutral" },
};

export default function BookingsScreen() {
  const { colors: ink } = useExperienceTheme();
  const router = useRouter();
  const auth = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [error, setError] = useState(false);
  const [walkIns, setWalkIns] = useState<Booking[]>([]);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [segPick, setSegPick] = useState<"active" | "upcoming" | "past" | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cars, setCars] = useState<Record<string, Vehicle>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [extraNames, setExtraNames] = useState<Record<string, string>>({});
  const [svcs, setSvcs] = useState<Record<string, Service>>({});
  useEffect(() => {
    if (auth.status !== "ready") return;
    const un = listenToMyVehicles(auth.user.uid, auth.claims.tenantId, (vs) => setCars(Object.fromEntries(vs.map((v) => [v.id, v]))), () => {});
    const unJobs = listenToMyJobs(auth.claims.tenantId, auth.user.uid, (js) => { setJobs(js); setWalkIns(js.filter((j) => !j.bookingId).map(bookingFromJob)); }, () => {});
    const unInv = listenToMyInvoices(auth.claims.tenantId, auth.user.uid, setInvoices, () => {});
    getServiceCatalogue().then((l) => setSvcs(Object.fromEntries(l.map((x) => [x.id, x])))).catch(() => {});
    return () => { un(); unJobs(); unInv(); };
  }, [auth]);

  const liveJob = liveJobOf(jobs);
  const liveJobId = liveJob?.id ?? null;
  useEffect(() => {
    setApprovals([]);
    if (auth.status !== "ready" || !liveJobId) return;
    return listenToApprovalsForJob(liveJobId, auth.claims.tenantId, auth.user.uid, setApprovals, () => {});
  }, [auth, liveJobId]);

  const load = useCallback(async () => {
    if (auth.status !== "ready") return;
    setError(false);
    try {
      setBookings(await getMyBookings(auth.user.uid, auth.claims.tenantId));
    } catch {
      setError(true);
    }
  }, [auth]);

  // Tabs stay mounted: reload every time the screen gains focus so a fresh booking shows up.
  useFocusEffect(
    useCallback(() => {
      if (auth.status === "ready") void load();
    }, [auth.status, load]),
  );

  useEffect(() => {
    const knownNow = Object.fromEntries(Object.values(svcs).map((x) => [x.id, x.name]));
    const ids = missingNameIds([...(bookings ?? []), ...walkIns].map((b) => b.serviceId), knownNow);
    if (ids.length === 0) return;
    let alive = true;
    void loadServiceNames(ids).then((m) => { if (alive && Object.keys(m).length) setExtraNames((p) => ({ ...p, ...m })); });
    return () => { alive = false; };
  }, [bookings, walkIns, svcs]);

  if (!bookings && !error) return <Loading label="Loading bookings" />;
  const all = [...(bookings ?? []), ...walkIns];
  const { inStudio, upcoming, past } = bookingSections(all);
  const known = { ...Object.fromEntries(Object.values(svcs).map((x) => [x.id, x.name])), ...extraNames };
  const nameOf = (b: Booking): string[] => visitServices(b, invoices.find((i) => i.jobId === b.id || i.bookingId === b.id), known);

  const list = (items: Booking[]) => (
    <View style={{ gap: 12 }}>
      {items.map((b) => {
        const car = cars[b.vehicleId] ?? (b.vehicleSnapshot ? { ...b.vehicleSnapshot, photoUrl: null, category: b.vehicleCategory } : undefined);
        const missed = isBookingMissed(b);
        return (
          <VisitCard key={b.id} onPress={() => router.push(`/(tabs)/bookings/${b.id}`)} photo={car?.photoUrl || !svcs[b.serviceId] ? <CarThumb car={car} height={64} width={64} radius={0} /> : <ServicePhoto service={svcs[b.serviceId]!} height={64} width={64} />} title={visitTitle(nameOf(b))} car={[car ? `${car.make} ${car.model}` : "Car", visitAlso(nameOf(b))].filter(Boolean).join(" \u00b7 ")} when={`${formatDateShort(b.scheduledDate)} \u00b7 ${b.scheduledTime}`} price={rupees(b.totalAmount)} chip={<Chip label={missed ? "Missed" : STATUS[b.status].label} tone={missed ? "danger" : STATUS[b.status].tone} />} />
        );
      })}
    </View>
  );

  const seg = segPick ?? (liveJob || approvals.some((a) => a.status === "pending") ? "active" : "upcoming");
  const stage = liveJob ? jobStage(liveJob.status) : null;
  const liveBooking = liveJob ? all.find((b) => b.id === (liveJob.bookingId ?? liveJob.id)) : undefined;
  const readyText = liveBooking && stage && stage.index < 3 && readyIsAhead(liveBooking.estimatedEndDate, liveBooking.estimatedEndTime) ? `${formatDateShort(liveBooking.estimatedEndDate)}, ${liveBooking.estimatedEndTime}` : null;
  const pending = approvals.filter((a) => a.status === "pending");
  const todayIst = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const next = upcoming[0];
  const nextCar = next ? cars[next.vehicleId] ?? (next.vehicleSnapshot ? { ...next.vehicleSnapshot, photoUrl: null, category: next.vehicleCategory } : undefined) : undefined;
  const nextElig = next ? getRescheduleEligibility(next) : null;
  const nextCancel = next ? cancelState(next) : null;
  const rebook = recentDistinctServices(all, 3).filter((b) => svcs[b.serviceId] && !svcs[b.serviceId]!.priceOnRequest);
  const doCancel = async () => {
    if (!next) return;
    setCancelBusy(true);
    setCancelError(null);
    try {
      await cancelBooking(next.id, "Cancelled by customer");
      setConfirmCancel(false);
      await load();
    } catch (err) {
      setCancelError(err instanceof Error && err.message && !/^(internal|functions)/i.test(err.message) ? err.message : "We could not cancel this booking. Check your connection and try again, or call the studio.");
    } finally {
      setCancelBusy(false);
    }
  };

  return (
    <Screen appBar="Bookings" header={<PageHeader title={liveJob ? "Your car is in the studio" : next ? "Your next visit is booked" : "Nothing booked right now"} sub={[upcoming.length > 0 ? `${upcoming.length} coming up` : "", past.length > 0 ? `${past.length} past` : ""].filter(Boolean).join(" · ") || "Book a service when you are ready."} />}>
      {error ? <Notice title="Can't load bookings" body="Check your connection and try again." action={<Button kind="quiet" label="Try again" onPress={() => void load()} />} /> : null}

      <TabPills tabs={[{ key: "active", label: "Active" }, { key: "upcoming", label: "Upcoming" }, { key: "past", label: "Past" }]} value={seg} onChange={setSegPick} />

      {seg === "active" && !liveJob && approvals.filter((a) => a.status === "pending").length === 0 ? <Notice title="Nothing active" body="When your car is in the studio, you can follow it here." /> : null}

      {seg === "active" && liveJob && stage ? (
        <Pane pad="inset">
          <View style={{ gap: metrics.innerGap }}>
            <Kicker tone="accent">In the studio</Kicker>
            <T role="heading">{stage.headline}</T>
            <T role="body" tone="secondary">{stage.line}</T>
            <View accessibilityRole="progressbar" accessibilityLabel={`Step ${Math.max(stage.index + 1, 0)} of ${STAGES.length}`} style={{ flexDirection: "row", gap: 6 }}>
              {STAGES.map((st, i) => <View key={st} style={{ flex: 1, height: 6, borderRadius: 4, backgroundColor: i <= stage.index ? "#EC8638" : glassInner.backgroundColor }} />)}
            </View>
            {readyText ? <T role="bodyStrong">Expected ready {readyText}</T> : null}
            <Button label="Track" onPress={() => router.push(`/(tabs)/bookings/${liveJob.bookingId ?? liveJob.id}`)} />
          </View>
        </Pane>
      ) : null}

      {seg === "active" && pending.length > 0 ? (
        <View style={{ gap: space.line }}>
          <SectionTitle>Waiting for your OK</SectionTitle>
          {pending.map((a) => (
            <VisitCard key={a.id} onPress={() => router.push(`/(tabs)/approvals/${a.id}`)} photo={<View style={{ flex: 1, backgroundColor: glassInner.backgroundColor }} />} title={a.serviceName} car={a.reason} when="Review and decide" price={a.priceImpact ? `+${rupees(a.priceImpact)}` : ""} chip={<Chip label="Needs your OK" tone="accent" />} />
          ))}
        </View>
      ) : null}

      {seg === "upcoming" && next ? (
        <View style={{ gap: space.line }}>
          <SectionTitle>Next visit</SectionTitle>
          <NextVisitHero date={next.scheduledDate} today={todayIst} time={next.scheduledTime} title={visitTitle(nameOf(next))} car={nextCar ? `${nextCar.make} ${nextCar.model}` : "Car"} status={isBookingMissed(next) ? "Missed" : STATUS[next.status].label} onPress={() => router.push(`/(tabs)/bookings/${next.id}`)} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {nextElig?.eligible ? <View style={{ flexGrow: 1, flexBasis: "45%" }}><Button kind="quiet" label="Reschedule" onPress={() => router.push({ pathname: "/(tabs)/bookings/reschedule", params: { bookingId: next.id } })} /></View> : null}
            {nextCancel?.canCancel && !confirmCancel ? <View style={{ flexGrow: 1, flexBasis: "45%" }}><Button kind="quiet" label="Cancel" onPress={() => setConfirmCancel(true)} /></View> : null}
            <View style={{ flexGrow: 1, flexBasis: "45%" }}><Button kind="quiet" label="Directions" onPress={() => void Linking.openURL(STUDIO_INFO.mapsUrl)} /></View>
            <View style={{ flexGrow: 1, flexBasis: "45%" }}><Button kind="quiet" label="Call studio" onPress={() => void Linking.openURL(`tel:${STUDIO_INFO.phone}`)} /></View>
          </View>
          {nextElig && !nextElig.eligible && nextElig.reason ? <T role="caption" tone="tertiary">{nextElig.reason}</T> : null}
          {nextCancel?.lateToCancel ? <T role="caption" tone="tertiary">Too close to the start to cancel online. Please call the studio.</T> : null}
          {confirmCancel ? (
            <Notice
              title="Cancel this booking?"
              body={next.paymentStatus === "paid" || next.paymentStatus === "partial" ? "This booking has been paid. The studio will contact you about the refund. This can't be undone." : "The slot is released straight away. This can't be undone."}
              action={
                <View style={{ gap: space.breath }}>
                  <Button label="Yes, cancel booking" kind="danger" busy={cancelBusy} onPress={() => void doCancel()} />
                  <Button label="Keep it" kind="quiet" onPress={() => setConfirmCancel(false)} />
                </View>
              }
            />
          ) : null}
          {cancelError ? <Notice title="Not cancelled" body={cancelError} /> : null}
          {upcoming.length > 1 ? <View style={{ gap: space.line }}><SectionTitle>Also coming up</SectionTitle>{list(upcoming.slice(1))}</View> : null}
        </View>
      ) : null}

      {seg === "upcoming" && !error && !next ? (
        <Pane pad="none" round="hero">
          <HeroImage source={sceneImagery.heroHome} />
          <View style={{ padding: metrics.cardPad, gap: space.breath }}>
            <T role="heading">Nothing booked</T>
            <T tone="secondary">Pick a service and a time. The studio confirms it.</T>
            <Button label="Book a service" onPress={() => router.push("/(tabs)/catalogue")} />
          </View>
        </Pane>
      ) : null}

      {seg === "upcoming" && rebook.length > 0 ? (
        <View style={{ gap: space.line }}>
          <SectionTitle>Book again</SectionTitle>
          {rebook.map((b) => {
            const sv = svcs[b.serviceId]!;
            return (
              <VisitCard key={sv.id} onPress={() => router.push(`/(tabs)/book/${sv.id}`)} photo={<ServicePhoto service={sv} height={64} />} title={sv.name.replace(/^Kovalent\s+/i, "")} car="Pick a time, then review" when="" price="" chip={<Chip label="Book again" tone="accent" />} />
            );
          })}
        </View>
      ) : null}

      {seg === "past" ? (
        past.length > 0 ? (
          <View style={{ gap: space.line }}>
            {groupByMonth(past).map((g) => <View key={g.key} style={{ gap: space.line }}><T role="label" tone="secondary">{g.label.toUpperCase()}</T>{list(g.items)}</View>)}
          </View>
        ) : <Notice title="No past visits" body="Finished and cancelled visits show here." />
      ) : null}
    </Screen>
  );
}
