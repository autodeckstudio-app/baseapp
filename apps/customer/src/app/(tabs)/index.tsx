import { RateCard } from "../../ui/RateCard";
import { rateCandidate } from "../../lib/rate-card";
import { liveTrackTarget } from "../../lib/bookings-view";
import { buildDrawerItems } from "../../lib/drawer-items";
import { referralCodeFor, referralShareMessage, referralSubtitle } from "../../lib/referral";
import { usePricingVehicle, useVehiclePrices, servicePriceText } from "../../lib/vehicle-size";
// Home: vehicle-first, one lead state (spec §6.2). What leads is decided by
// projectCustomerHome from the customer's own records - never invented here.
import { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Share, View } from "react-native";
import { STUDIO_INFO, WHATSAPP_CHANNEL_URL, INSTAGRAM_URL, INSTAGRAM_HANDLE } from "../../lib/studio-info";
import { openStatus } from "../../lib/open-status";
import { carNeed } from "../../lib/home-needs";
import { getOffers, offerToCampaign } from "../../lib/offer-service";
import type { OfferView } from "@autodeck/core";
import { getStudioInfo } from "../../lib/booking-service";
import { listenToJobsForVehicle } from "../../lib/job-service";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { useRouter } from "expo-router";
import { greetingFor, type CustomerHomeModel } from "@autodeck/core";
import { FadeUp, Icon, Logo, useExperienceTheme } from "@autodeck/ui/native";
import { space } from "@autodeck/ui/theme";
import { formatDateShort } from "@autodeck/ui";
import { useAuth } from "../../hooks/useAuth";
import { useCustomerHome } from "../../hooks/useCustomerHome";
import { sceneImagery, vehicleImagery, serviceImagery } from "../../lib/imagery";
import { listenToMyNotifications } from "../../lib/notification-service";
import { listenToVehiclePapers, daysUntil, type MyPaper } from "../../lib/paper-service";
import { listenToVehicleWarranties } from "../../lib/warranty-service";
import type { Service, Booking } from "@autodeck/core";
import { getMyBookings } from "../../lib/booking-service";
import { lastCompletedService } from "../../lib/booking-sections";
import { getServiceCatalogue} from "../../lib/catalogue-service";
import { getStories, groupStories, type StoryGroup } from "../../lib/story-service";
import { StoryCircles } from "../../ui/StoryCircles";
import { HomeView } from "../../ui/HomeView";
import { getCarListings } from "../../lib/carsale-service";
import { pickFeaturedCar } from "../../lib/cars-home";
import type { CarListingView } from "@autodeck/core";
import { StoryViewer } from "../../ui/StoryViewer";
import { HeroImage, Button, Chip, Kicker, Notice, Pane, Plate, Row, Screen, Skeleton, T, rupees } from "../../ui/kit";

const HERO_COPY: Record<CustomerHomeModel["heroState"], { kicker: string; line: string }> = {
  empty: { kicker: "Welcome", line: "Add your car to book care, track visits and keep its papers in one place." },
  idle: { kicker: "All good", line: "Nothing needs you right now." },
  booked: { kicker: "Booked", line: "Your next visit is set." },
  inService: { kicker: "In the studio", line: "Your car is being looked after." },
  awaitingApproval: { kicker: "Your call", line: "The studio found extra work and needs your OK." },
  paymentDue: { kicker: "All good", line: "Nothing needs you right now." }, // unreachable: Home no longer ranks bills
  ready: { kicker: "Ready", line: "Your car is ready for pickup." },
};

const JOB_STAGE: Record<string, string> = {
  STANDBY: "Arrived - standby",
  PENDING_VEHICLE: "Waiting for your car",
  VEHICLE_RECEIVED: "Checked in",
  IN_PROGRESS: "Work under way",
  QUALITY_CHECK: "Final checks",
  READY_FOR_DELIVERY: "Ready for pickup",
  DELIVERED: "Delivered",
};

const STAGES = ["PENDING_VEHICLE", "VEHICLE_RECEIVED", "IN_PROGRESS", "QUALITY_CHECK", "READY_FOR_DELIVERY", "DELIVERED"] as const;
const STAGE_SHORT = ["Booked", "Checked in", "Working", "Final check", "Ready", "Done"];

function StatusRail({ status }: { status: string }) {
  const { colors } = useExperienceTheme();
  if (status === "STANDBY") return <T role="body" tone="tertiary">Arrived - standby. Waiting for a bay, no time reserved.</T>;
  const at = Math.max(0, STAGES.indexOf(status as (typeof STAGES)[number]));
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {STAGES.map((st, i) => (
          <View key={st} style={{ flex: i === STAGES.length - 1 ? 0 : 1, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: i === at ? 16 : 10, height: i === at ? 16 : 10, borderRadius: 8, backgroundColor: i <= at ? colors.accent : "transparent", borderWidth: 1, borderColor: i <= at ? colors.accent : colors.borderSubtle }} />
            {i < STAGES.length - 1 ? <View style={{ flex: 1, height: 2, backgroundColor: i < at ? colors.accent : colors.borderSubtle }} /> : null}
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {STAGE_SHORT.map((l, i) => (
          <T key={l} role="caption" tone={i === at ? "accent" : "tertiary"} style={{ fontSize: 12 }}>{l}</T>
        ))}
      </View>
    </View>
  );
}

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const ready = auth.status === "ready";
  const myCode = ready ? referralCodeFor(auth.user.uid) : null;
  const home = useCustomerHome(ready ? auth.user.uid : null, ready ? auth.claims.tenantId : null, ready ? auth.user.displayName : null);
  const [unread, setUnread] = useState(0);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [open, setOpen] = useState<StoryGroup | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [catalogue, setCatalogue] = useState<Service[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [carListings, setCarListings] = useState<CarListingView[] | null>(null);
  useEffect(() => { if (ready) void getCarListings(false).then(setCarListings).catch(() => undefined); }, [ready]);
  const pricingVehicle = usePricingVehicle();
  const vehiclePrices = useVehiclePrices(catalogue, pricingVehicle.category);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const loadStories = (tries: number) => void getStories().then((l) => { if (!alive) return; if (l.length === 0 && tries > 0) setTimeout(() => loadStories(tries - 1), 2500); else setGroups(groupStories(l)); }).catch(() => undefined);
    loadStories(2);
    const loadCatalogue = (tries: number) => {
      void getServiceCatalogue()
        .then((all) => {
          if (!alive) return;
          setCatalogueFailed(false);
          setCatalogue(all);

        })
        .catch(() => { if (!alive) return; if (tries > 0) setTimeout(() => loadCatalogue(tries - 1), 2000); else setCatalogueFailed(true); });
    };
    loadCatalogue(2);
    return () => { alive = false; };
  }, [ready, retryTick]);

  useEffect(() => {
    if (!ready) return;
    return listenToMyNotifications(auth.claims.tenantId, auth.user.uid, (n) => setUnread(n.filter((x) => x.readAt === null).length), () => undefined);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void getMyBookings(auth.user.uid, auth.claims.tenantId).then((l) => { if (alive) setPast(l); }).catch(() => undefined);
    return () => { alive = false; };
  }, [ready]);
  const carId = ready ? home.model?.activeVehicle?.id ?? null : null;
  const [offers, setOffers] = useState<OfferView[]>([]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void getOffers().then((l) => { if (alive) setOffers(l); });
    return () => { alive = false; };
  }, [ready]);
  const [liveInfo, setLiveInfo] = useState<{ operatingHours: Array<{ dayOfWeek: number; open: string; close: string; closed: boolean }>; holidays: string[] } | null>(null);
  const [carJobs, setCarJobs] = useState<Array<{ serviceId: string; status: string; createdAt: string; sealedAt?: string | null }>>([]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    void getStudioInfo(FIRST_STUDIO_ID).then((i) => { if (alive && i.operatingHours?.length) setLiveInfo(i); }).catch(() => undefined);
    return () => { alive = false; };
  }, [ready]);
  useEffect(() => {
    setCarJobs([]);
    if (!ready || !carId) return;
    return listenToJobsForVehicle(carId, auth.claims.tenantId, auth.user.uid, (j) => setCarJobs(j as never), () => undefined);
  }, [ready, carId]);
  const [papers, setPapers] = useState<MyPaper[]>([]);
  const [warranties, setWarranties] = useState<Array<{ warrantyLabel: string; endDate: string | null; revokedAt: string | null }>>([]);
  useEffect(() => {
    setPapers([]);
    if (!ready || !carId) return;
    return listenToVehiclePapers(carId, auth.claims.tenantId, auth.user.uid, setPapers, () => undefined);
  }, [ready, carId]);
  useEffect(() => {
    setWarranties([]);
    if (!ready || !carId) return;
    return listenToVehicleWarranties(carId, auth.claims.tenantId, auth.user.uid, (w) => setWarranties(w as never), () => undefined);
  }, [ready, carId]);

  if (!ready || !home.model) {
    return (
      <Screen>
        <Skeleton height={28} width="55%" />
        <Skeleton height={64} />
        <Skeleton height={120} />
        <Skeleton height={56} />
        <Skeleton height={56} />
        <Skeleton height={56} />
      </Screen>
    );
  }
  const m = home.model;
  const copy = HERO_COPY[m.heroState];
  const car = m.activeVehicle;
  const KIND: Record<string, string> = { insurance: "Insurance", fasttag: "FASTag", puc: "PUC", rc: "RC", extended_warranty: "Extended warranty" };
  const reminders: Array<{ title: string; detail: string; chip: string; danger: boolean }> = [];
  for (const p of papers) {
    const left = daysUntil(p.expiresOn);
    const name = KIND[p.kind.toLowerCase()] ?? "Document";
    if (left !== null && left < 0) reminders.push({ title: name, detail: "Expired. Upload the renewed copy.", chip: "Expired", danger: true });
    else if (left !== null && left <= 30) reminders.push({ title: name, detail: `Expires ${formatDateShort(p.expiresOn as string)}`, chip: `${left} day${left === 1 ? "" : "s"}`, danger: false });
  }
  for (const w of warranties) {
    const left = daysUntil(w.endDate);
    if (!w.revokedAt && left !== null && left >= 0 && left <= 60) reminders.push({ title: w.warrantyLabel, detail: `Ends ${formatDateShort(w.endDate as string)}`, chip: `${left} days`, danger: false });
  }

  const act = () => {
    const a = m.primaryAction;
    switch (a.kind) {
      case "addVehicle":
        return router.push("/(tabs)/garage/add");
      case "book":
        return router.push("/(tabs)/catalogue");
      case "viewBooking":
      case "followVisit":
        return router.push(`/(tabs)/bookings/${a.targetId}`);
      case "reviewApproval":
        return router.push(`/(tabs)/approvals/${a.targetId}`);
      case "reviewProtection":
        return car ? router.push(`/(tabs)/garage/${car.id}`) : undefined;
    }
  };

  const liveId = liveTrackTarget(m.liveJob, null);
  const nextId = liveTrackTarget(null, m.upcomingBooking?.id);
  const live = m.pendingApproval
    ? { kicker: "Needs your OK", title: m.pendingApproval.serviceName, detail: m.pendingApproval.reason, onPress: () => router.push(`/(tabs)/approvals/${m.pendingApproval!.id}`) }
    : m.liveJob
      ? { kicker: "Live now", title: JOB_STAGE[m.liveJob.status] ?? "In the studio", detail: `Since ${new Date(m.liveJob.scheduledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`, onPress: () => router.push(liveId ? `/(tabs)/bookings/${liveId}` : "/(tabs)/bookings") }
      : m.upcomingBooking
        ? { kicker: "Next visit", title: `${formatDateShort(m.upcomingBooking.scheduledDate)} \u00b7 ${m.upcomingBooking.scheduledTime}`, detail: m.upcomingBooking.status === "PENDING" ? "Waiting for the studio to confirm" : "Confirmed", onPress: () => router.push(nextId ? `/(tabs)/bookings/${nextId}` : "/(tabs)/bookings") }
        : { kicker: copy.kicker, title: m.primaryAction.label, detail: copy.line, onPress: act, idle: true };
  const rateB = rateCandidate(past);
  const vehicles = [m.activeVehicle, ...m.otherVehicles].filter(Boolean) as NonNullable<typeof m.activeVehicle>[];

  return (
    <Screen>
      <HomeView
        greeting={greetingFor(new Date(), m.customer.firstName)}
        initial={(m.customer.firstName ?? auth.user.displayName ?? "A").trim().charAt(0).toUpperCase() || "A"}
        progress={m.liveJob ? ({ PENDING_VEHICLE: 10, VEHICLE_RECEIVED: 25, IN_PROGRESS: 55, QUALITY_CHECK: 85, READY_FOR_DELIVERY: 100, DELIVERED: 100 } as Record<string, number>)[m.liveJob.status] ?? 10 : null}
        stage={m.liveJob ? JOB_STAGE[m.liveJob.status] ?? "In the studio" : m.upcomingBooking ? `Next visit ${formatDateShort(m.upcomingBooking.scheduledDate)}` : "Parked, all good"}
        membership={m.membership && m.membership.status === "active" ? { title: `${Math.max(0, m.membership.washesTotal - m.membership.washesUsed)} washes`, detail: `left${m.membership.endDate ? `, until ${formatDateShort(m.membership.endDate)}` : ""}` } : null}
        studio={{ address: STUDIO_INFO.address.replace(", Gujarat", ""), hours: STUDIO_INFO.hours, openText: openStatus(liveInfo?.operatingHours, liveInfo?.holidays)?.text ?? null }}
        campaign={offerToCampaign(offers, (h) => router.push(h as never))}
        need={(() => { const n = carNeed(carJobs, Object.fromEntries(catalogue.map((x) => [x.id, { id: x.id, name: x.name, category: x.category }]))); return n ? { title: n.title, detail: n.detail, onPress: () => router.push(`/(tabs)/book/${n.serviceId}`) } : null; })()}
        social={[
          ...(WHATSAPP_CHANNEL_URL ? [{ key: "wac", title: "WhatsApp", sub: "Our channel", icon: "channel" as const, onPress: () => void Linking.openURL(WHATSAPP_CHANNEL_URL) }] : []),
          ...(INSTAGRAM_URL ? [{ key: "ig", title: "Instagram", sub: `@${INSTAGRAM_HANDLE}`, icon: "instagram" as const, onPress: () => void Linking.openURL(INSTAGRAM_URL) }] : []),
        ]}
        quick={[
          ...(STUDIO_INFO.phone ? [{ key: "call", label: "Call", icon: "call" as const, onPress: () => void Linking.openURL(`tel:${STUDIO_INFO.phone}`) }] : []),
          ...(STUDIO_INFO.whatsapp ? [{ key: "wa", label: "WhatsApp", icon: "whatsapp" as const, onPress: () => void Linking.openURL(`https://wa.me/${STUDIO_INFO.whatsapp}`) }] : []),
          ...(STUDIO_INFO.mapsUrl ? [{ key: "map", label: "Directions", icon: "directions" as const, onPress: () => void Linking.openURL(STUDIO_INFO.mapsUrl) }] : []),
        ]}
        onAvatar={() => router.push("/(tabs)/profile")}
        displayName={(m.customer.firstName ?? auth.user.displayName ?? "AutoDeck").trim()}
        carsCard={pickFeaturedCar(carListings)}
        onBuyCar={() => router.push("/(tabs)/cars")}
        onSellCar={() => router.push("/(tabs)/cars/sell")}
        drawer={buildDrawerItems((path) => router.push(path as never), myCode)}
        onBook={() => router.push("/(tabs)/catalogue")}
        onStudio={() => router.push("/(tabs)/studio")}
        onMembership={() => router.push("/(tabs)/membership")}
        onVisits={() => router.push("/(tabs)/bookings")}
        onShare={() => void Share.share({ message: referralShareMessage(myCode) }).catch(() => undefined)}
        unread={unread}
        cars={vehicles.map((v) => ({ id: v.id, title: `${v.make} ${v.model}`, plate: v.registrationNumber, vehicle: { photoUrl: v.photoUrl, category: v.category, updatedAt: v.updatedAt }, category: v.category ?? null, hasPhoto: !!v.photoUrl }))}
        services={catalogue.map((s) => ({ id: s.id, category: s.category, name: s.name, price: servicePriceText(s, pricingVehicle.category, vehiclePrices) ?? "", brand: s.brand ?? null }))}
        reminders={reminders}
        live={live}
        rebook={(() => { const b = lastCompletedService(past); const sv = b ? catalogue.find((x) => x.id === b.serviceId) : undefined; return b && sv && !sv.priceOnRequest ? { serviceName: sv.name, onPress: () => router.push(`/(tabs)/book/${sv.id}`) } : null; })()}
        stories={groups.length > 0 ? <StoryCircles groups={groups} seen={seen} onOpen={(g) => { setOpen(g); setSeen(new Set([...seen, g.key])); }} /> : null}
        banner={<>{home.error ? <Notice title="Some details are unavailable" body={home.error} action={<Button kind="quiet" label="Retry" onPress={home.refresh} />} /> : null}{rateB ? <RateCard key={rateB.id} bookingId={rateB.id} serviceName={catalogue.find((x) => x.id === rateB.serviceId)?.name ?? "visit"} /> : null}</>}
        onSearch={() => router.push("/(tabs)/catalogue")}
        onBell={() => router.push("/(tabs)/notifications")}
        onAllServices={() => router.push("/(tabs)/catalogue")}
        onCategory={() => undefined}
        onService={(sv) => router.push(`/(tabs)/catalogue/${sv.id}`)}
        onCar={(c) => router.push(`/(tabs)/garage/${c.id}`)}
        onAddCar={() => router.push("/(tabs)/garage/add")}
        onReminders={() => (car ? router.push(`/(tabs)/garage/${car.id}`) : undefined)}
      />
      <StoryViewer group={open} onClose={() => setOpen(null)} />
    </Screen>
  );
}
