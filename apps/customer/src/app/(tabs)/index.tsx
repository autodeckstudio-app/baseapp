import { invoiceHref } from "../../lib/invoice-display";
import {homeServiceTarget} from "../../lib/home-service-navigation";
import { RateCard } from "../../ui/RateCard";
import { listOwnerKey } from "../../lib/owner-key";
import { rateCandidate } from "../../lib/rate-card";
import { liveTrackTarget, sinceLabel } from "../../lib/bookings-view";
import { LIVE_PROGRESS } from "../../lib/garage-live";
import { buildDrawerItems } from "../../lib/drawer-items";
import { referralCodeFor, referralShareMessage, referralSubtitle } from "../../lib/referral";
import { useVehiclePrices, servicePriceText } from "../../lib/vehicle-size";
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
import { normalizeSegment, FIRST_STUDIO_ID } from "@autodeck/core";
import { useRouter } from "expo-router";
import { greetingFor, type CustomerHomeModel } from "@autodeck/core";
import { FadeUp, Icon, Logo, useExperienceTheme } from "@autodeck/ui/native";
import { space } from "@autodeck/ui/theme";
import { formatDateShort } from "@autodeck/ui";
import { lastFinishedJob } from "../../lib/care-due";
import { useAuth } from "../../hooks/useAuth";
import { useCustomerHome } from "../../hooks/useCustomerHome";
import { sceneImagery, serviceImagery } from "../../lib/imagery";
import { listenToMyNotifications } from "../../lib/notification-service";
import { listenToVehiclePapers, daysUntil, type MyPaper } from "../../lib/paper-service";
import { listenToVehicleWarranties } from "../../lib/warranty-service";
import type { Service, Booking } from "@autodeck/core";
import { getMyBookings } from "../../lib/booking-service";
import { lastCompletedService } from "../../lib/booking-sections";
import { getServiceCatalogue} from "../../lib/catalogue-service";
import { getStories, groupStories, type StoryGroup } from "../../lib/story-service";
import { seenKeyOf } from "../../lib/story-groups";
import { StoryCircles } from "../../ui/StoryCircles";
import { HomeView } from "../../ui/HomeView";
import { getCarListings } from "../../lib/carsale-service";
import { homeCars } from "../../lib/cars-home";
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
  const ownerKey = ready ? listOwnerKey(auth) : null;
  const owner = ready ? `${auth.claims.tenantId}:${auth.user.uid}:${ownerKey?.key ?? ""}` : null;
  const myCode = ready ? referralCodeFor(auth.user.uid) : null;
  const home = useCustomerHome(ownerKey ? ownerKey.key : null, ready ? auth.claims.tenantId : null, ready ? auth.user.displayName : null);
  const [unread, setUnread] = useState(0);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [open, setOpen] = useState<StoryGroup | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [catalogue, setCatalogue] = useState<Service[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [carListings, setCarListings] = useState<CarListingView[] | null>(null);
  useEffect(() => {let alive=true;setCarListings(null);if(ready)void getCarListings(false).then(v=>{if(alive)setCarListings(v)}).catch(()=>undefined);return()=>{alive=false}}, [owner]);
  const pricingVehicle = {category:normalizeSegment(home.model?.activeVehicle?.category)};
  const vehiclePrices = useVehiclePrices(catalogue, pricingVehicle.category);
  useEffect(() => {
    setGroups([]);setOpen(null);setSeen(new Set());setCatalogue([]);setCatalogueFailed(false);if (!ready) return;
    let alive = true;
    const loadStories = (tries: number) => {if(!alive)return;void getStories().then((l) => { if (!alive) return; if (l.length === 0 && tries > 0) setTimeout(() => loadStories(tries - 1), 2500); else setGroups(groupStories(l)); }).catch(() => undefined);};
    loadStories(2);
    const loadCatalogue = (tries: number) => {
      if(!alive)return;void getServiceCatalogue()
        .then((all) => {
          if (!alive) return;
          setCatalogueFailed(false);
          setCatalogue(all);

        })
        .catch(() => { if (!alive) return; if (tries > 0) setTimeout(() => loadCatalogue(tries - 1), 2000); else setCatalogueFailed(true); });
    };
    loadCatalogue(2);
    return () => { alive = false; };
  }, [owner, retryTick]);

  useEffect(() => {
    setUnread(0);if (!ready) return;let alive=true;
    const stop=listenToMyNotifications(auth.claims.tenantId, auth.user.uid, (n) => {if(alive)setUnread(n.filter((x) => x.readAt === null).length)}, () => undefined);return()=>{alive=false;stop()};
  }, [owner]);

  useEffect(() => {
    setPast([]);if (!ready || !ownerKey) return;
    let alive = true;
    void getMyBookings(ownerKey.key, auth.claims.tenantId).then((l) => { if (alive) setPast(l); }).catch(() => undefined);
    return () => { alive = false; };
  }, [owner]);
  const carId = ready ? home.model?.activeVehicle?.id ?? null : null;
  const [offers, setOffers] = useState<OfferView[]>([]);
  useEffect(() => {
    setOffers([]);if (!ready) return;
    let alive = true;
    void getOffers().then((l) => { if (alive) setOffers(l); }).catch(()=>undefined);
    return () => { alive = false; };
  }, [owner]);
  const [liveInfo, setLiveInfo] = useState<{ operatingHours: Array<{ dayOfWeek: number; open: string; close: string; closed: boolean }>; holidays: string[] } | null>(null);
  const [carJobsSource, setCarJobsSource] = useState<{scope:string;rows:Array<{ serviceId: string; serviceName?: string; status: string; createdAt: string; sealedAt?: string | null }>}>({scope:"",rows:[]});
  const carScope=`${owner}:${carId}`;
  const carJobs=carJobsSource.scope===carScope?carJobsSource.rows:[];
  useEffect(() => {
    setLiveInfo(null);if (!ready) return;
    let alive = true;
    void getStudioInfo(FIRST_STUDIO_ID).then((i) => { if (alive && i.operatingHours?.length) setLiveInfo(i); }).catch(() => undefined);
    return () => { alive = false; };
  }, [owner]);
  useEffect(() => {
    setCarJobsSource({scope:carScope,rows:[]});
    if (!ready || !auth.customerDocId || !carId) return;
    let alive=true;const stop=listenToJobsForVehicle(carId, auth.claims.tenantId, auth.customerDocId, (v)=>{if(alive)setCarJobsSource({scope:carScope,rows:v as never})}, () => undefined);return()=>{alive=false;stop()};
  }, [owner, carId]);
  const [paperSource,setPaperSource]=useState<{scope:string;rows:MyPaper[]}>({scope:"",rows:[]});
  const papers=paperSource.scope===carScope?paperSource.rows:[];
  const [warrantySource,setWarrantySource]=useState<{scope:string;rows:Array<{warrantyLabel:string;endDate:string|null;revokedAt:string|null}>}>({scope:"",rows:[]});
  const warranties=warrantySource.scope===carScope?warrantySource.rows:[];
  useEffect(() => {
    setPaperSource({scope:carScope,rows:[]});
    if (!ready || !auth.customerDocId || !carId) return;
    let alive=true;const stop=listenToVehiclePapers(carId, auth.claims.tenantId, auth.customerDocId, (v)=>{if(alive)setPaperSource({scope:carScope,rows:v as never})}, () => undefined);return()=>{alive=false;stop()};
  }, [owner, carId]);
  useEffect(() => {
    setWarrantySource({scope:carScope,rows:[]});
    if (!ready || !auth.customerDocId || !carId) return;
    let alive=true;const stop=listenToVehicleWarranties(carId, auth.claims.tenantId, auth.customerDocId, (v)=>{if(alive)setWarrantySource({scope:carScope,rows:v as never})}, () => undefined);return()=>{alive=false;stop()};
  }, [owner, carId]);

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
        return router.navigate("/(tabs)/catalogue");
      case "payInvoice":
        return a.targetId ? router.push(invoiceHref(a.targetId)) : router.navigate("/(tabs)/bookings");
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
    ? { kicker: "Needs your OK", title: m.pendingApproval.serviceName, detail: m.pendingApproval.reason, onPress: () => router.push({ pathname: "/(tabs)/approvals/[id]", params: { id: m.pendingApproval!.id, returnTo: "home" } }) }
    : m.dueInvoice
      ? { kicker: "Payment due", title: "View your bill", detail: "Review the issued invoice", onPress: () => router.push({ ...invoiceHref(m.dueInvoice!.id), params: { invoiceId: m.dueInvoice!.id, returnTo: "home" } }) }
    : m.liveJob
      ? { kicker: "Live now", title: JOB_STAGE[m.liveJob.status] ?? "In the studio", detail: sinceLabel(m.liveJob.scheduledAt), ready: m.liveJob.estimatedEndAt && new Date(m.liveJob.estimatedEndAt).getTime() > Date.now() ? new Date(m.liveJob.estimatedEndAt).toLocaleString("en-IN", { weekday: "short", hour: "numeric", minute: "2-digit" }) : null, onPress: () => router.push(liveId ? { pathname: "/(tabs)/bookings/[id]", params: { id: liveId, returnTo: "home" } } : "/(tabs)/bookings") }
      : m.upcomingBooking
        ? { kicker: "Next visit", title: `${formatDateShort(m.upcomingBooking.scheduledDate)} \u00b7 ${m.upcomingBooking.scheduledTime}`, detail: m.upcomingBooking.status === "PENDING" ? "Waiting for the studio to confirm" : "Confirmed", onPress: () => router.push(nextId ? { pathname: "/(tabs)/bookings/[id]", params: { id: nextId, returnTo: "home" } } : "/(tabs)/bookings") }
        : { kicker: copy.kicker, title: m.primaryAction.label, detail: copy.line, onPress: act, idle: true };
  const selectedPast=past.filter(b=>b.vehicleId===carId);
  const rateB = rateCandidate(selectedPast);
  const vehicles = ([m.activeVehicle, ...m.otherVehicles].filter(Boolean) as NonNullable<typeof m.activeVehicle>[]).sort((a,b)=>a.id.localeCompare(b.id));

  return (
    <Screen bottomClearance={80}>
      <HomeView
        greeting={greetingFor(new Date(), m.customer.firstName)}
        initial={(m.customer.firstName ?? auth.user.displayName ?? "A").trim().charAt(0).toUpperCase() || "A"}
        progress={m.liveJob ? LIVE_PROGRESS[m.liveJob.status] ?? 10 : null}
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
        onAvatar={() => router.navigate("/(tabs)/profile")}
        displayName={(m.customer.firstName ?? auth.user.displayName ?? "AutoDeck").trim()}
        carsList={homeCars(carListings)}
        onOpenCar={(id) => router.push(`/(tabs)/cars/${id}` as never)}
        onBuyCar={() => router.navigate("/(tabs)/cars")}
        onSellCar={() => router.navigate("/(tabs)/cars/sell")}
        drawer={buildDrawerItems((path) => router.push(path as never), myCode)}
        onBook={() => router.navigate("/(tabs)/catalogue")}
        onStudio={() => router.navigate("/(tabs)/studio")}
        onMembership={() => router.push({ pathname: "/(tabs)/membership", params: { returnTo: "home" } })}
        onVisits={() => router.navigate("/(tabs)/bookings")}
        onShare={() => void Share.share({ message: referralShareMessage(myCode) }).catch(() => undefined)}
        unread={unread}
        cars={(() => { const last = lastFinishedJob(carJobs); const name = last ? last.serviceName ?? catalogue.find((x) => x.id === last.serviceId)?.name ?? null : null; const story = last && name ? `Last visit: ${name}${last.sealedAt ? ` \u00b7 ${formatDateShort(last.sealedAt.slice(0, 10))}` : ""}` : null; return vehicles.map((v) => ({ id: v.id, title: `${v.make} ${v.model}`, plate: v.registrationNumber, vehicle: { photoUrl: v.photoUrl, category: v.category, updatedAt: v.updatedAt }, category: v.category ?? null, hasPhoto: !!v.photoUrl, story: v.id === m.activeVehicle?.id ? story : null })); })()}
        services={catalogue.map((s) => ({ id: s.id, category: s.category, name: s.name, price: servicePriceText(s, pricingVehicle.category, vehiclePrices) ?? "", brand: s.brand ?? null }))}
        reminders={reminders}
        live={live}
        rebook={(() => { const b = lastCompletedService(selectedPast); const sv = b ? catalogue.find((x) => x.id === b.serviceId) : undefined; return b && sv && !sv.priceOnRequest ? { serviceName: sv.name, onPress: () => router.push(`/(tabs)/book/${sv.id}`) } : null; })()}
        stories={groups.length > 0 ? <StoryCircles groups={groups} seen={seen} onOpen={(g) => { setOpen(g); setSeen(new Set([...seen, seenKeyOf(g)])); }} /> : null}
        banner={<>{home.error ? <Notice title="Some details are unavailable" body={home.error} action={<Button kind="quiet" icon="refresh" label="Retry" onPress={home.refresh} />} /> : null}{rateB ? <RateCard key={rateB.id} bookingId={rateB.id} serviceName={catalogue.find((x) => x.id === rateB.serviceId)?.name ?? "visit"} /> : null}</>}
        onSearch={() => router.navigate("/(tabs)/catalogue")}
        onBell={() => router.navigate("/(tabs)/notifications")}
        onAllServices={() => router.navigate("/(tabs)/catalogue")}
        onCategory={() => undefined}
        onService={(sv, key) => router.push(homeServiceTarget(sv, key) as never)}
        onCar={(c) => router.push({ pathname: "/(tabs)/garage/[id]", params: { id: c.id, returnTo: "home" } })}
        onAddCar={() => router.push("/(tabs)/garage/add")}
        activeCarId={car?.id}
        onSelectCar={home.selectVehicle}
        onGarage={() => router.navigate("/(tabs)/garage")}
        onReminders={() => (car ? router.push({ pathname: "/(tabs)/garage/[id]", params: { id: car.id, returnTo: "home" } }) : undefined)}
      />
      <StoryViewer
        identityKey={ready ? `${auth.user.uid}:${auth.claims.tenantId}` : null}
        group={open}
        onClose={() => setOpen(null)}
        onNextGroup={() => { const n = open ? groups[groups.findIndex((x) => x.key === open.key) + 1] : undefined; if (n) { setOpen(n); setSeen(new Set([...seen, seenKeyOf(n)])); } else setOpen(null); }}
        onPrevGroup={() => { const n = open ? groups[groups.findIndex((x) => x.key === open.key) - 1] : undefined; if (n) setOpen(n); }}
      />
    </Screen>
  );
}
