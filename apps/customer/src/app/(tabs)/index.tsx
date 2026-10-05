// Home: vehicle-first, one lead state (spec §6.2). What leads is decided by
// projectCustomerHome from the customer's own records - never invented here.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Platform, Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { greetingFor, type CustomerHomeModel } from "@autodeck/core";
import { ExperienceThemeProvider, Icon, Logo, useExperienceTheme } from "@autodeck/ui/native";
import { space } from "@autodeck/ui/theme";
import { formatDateShort } from "@autodeck/ui";
import { useAuth } from "../../hooks/useAuth";
import { useCustomerHome } from "../../hooks/useCustomerHome";
import { sceneImagery, vehicleImagery } from "../../lib/imagery";
import { useVehiclePhotoUri } from "../../ui/CarThumb";
import { listenToMyNotifications } from "../../lib/notification-service";
import { listenToVehiclePapers, daysUntil, type MyPaper } from "../../lib/paper-service";
import { listenToVehicleWarranties } from "../../lib/warranty-service";
import type { Service } from "@autodeck/core";
import { getServiceCatalogue, priceLabel } from "../../lib/catalogue-service";
import { getAvailability, todayIST, type AvailableSlot } from "../../lib/booking-service";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getStories, groupStories, type StoryGroup } from "../../lib/story-service";
import { StoryCircles } from "../../ui/StoryCircles";
import { StoryViewer } from "../../ui/StoryViewer";
import { Stage, DepthCarousel } from "../../ui/Immersive";
import { HeroImage, Button, Chip, Kicker, Loading, Notice, Pane, Plate, Row, Screen, Skeleton, T, rupees } from "../../ui/kit";

const HERO_COPY: Record<CustomerHomeModel["heroState"], { kicker: string; line: string }> = {
  empty: { kicker: "Welcome", line: "Add your car to book care, track visits and keep its papers in one place." },
  idle: { kicker: "All good", line: "Nothing needs you right now." },
  booked: { kicker: "Booked", line: "Your next visit is set." },
  inService: { kicker: "In the studio", line: "Your car is being looked after." },
  awaitingApproval: { kicker: "Your call", line: "The studio found extra work and needs your OK." },
  paymentDue: { kicker: "Bill ready", line: "Your bill is ready to settle." },
  ready: { kicker: "Ready", line: "Your car is ready for pickup." },
};

const JOB_STAGE: Record<string, string> = {
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
          <T key={l} role="caption" tone={i === at ? "accent" : "tertiary"} style={{ fontSize: 10 }}>{l}</T>
        ))}
      </View>
    </View>
  );
}

function FadeUp({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 520, delay, useNativeDriver: Platform.OS !== "web" }).start();
  }, [v, delay]);
  return <Animated.View style={{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }}>{children}</Animated.View>;
}

const DISC_SHADOW = { shadowColor: "#281E3C", shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 4, height: 6 }, elevation: 5 } as const;

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const ready = auth.status === "ready";
  const home = useCustomerHome(ready ? auth.user.uid : null, ready ? auth.claims.tenantId : null, ready ? auth.user.displayName : null);
  const [unread, setUnread] = useState(0);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [open, setOpen] = useState<StoryGroup | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [picks, setPicks] = useState<Service[]>([]);
  const [catalogue, setCatalogue] = useState<Service[]>([]);
  const [focus, setFocus] = useState<"washing" | "ceramic" | "ppf" | null>(null);
  const [slotsFor, setSlotsFor] = useState<{ service: Service; slots: AvailableSlot[] } | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const loadStories = (tries: number) => void getStories().then((l) => { if (!alive) return; if (l.length === 0 && tries > 0) setTimeout(() => loadStories(tries - 1), 2500); else setGroups(groupStories(l)); });
    loadStories(2);
    const loadCatalogue = (tries: number) => {
      void getServiceCatalogue()
        .then((all) => {
          if (!alive) return;
          setCatalogueFailed(false);
          setCatalogue(all);
          const order = ["washing", "ceramic", "coating", "ppf", "tinting", "inspection"];
          setPicks([...all].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.basePrice - b.basePrice).filter((x, n, arr) => arr.findIndex((y) => y.category === x.category) === arr.indexOf(x) || n < 8).slice(0, 8));
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

  const carPhoto = useVehiclePhotoUri(ready ? home.model?.activeVehicle : null);
  const carId = ready ? home.model?.activeVehicle?.id ?? null : null;
  const lastVisitServiceId = (ready ? (home.model?.recentHistory[0] as { serviceId?: string } | undefined)?.serviceId : undefined) ?? null;
  // Suggestion is category-led (washing, ceramic or PPF), chosen from the car's real history:
  // washing when it is due or has no visit yet; otherwise ceramic when no protection is on file; else washing.
  const lastVisitDate = ready ? home.model?.recentHistory[0]?.scheduledDate : undefined;
  const visitDays = lastVisitDate ? Math.max(0, Math.round((Date.now() - new Date(lastVisitDate).getTime()) / 86400000)) : null;
  const hasProtection = ready ? (home.model?.protections?.length ?? 0) > 0 : false;
  const autoFocus: "washing" | "ceramic" | "ppf" = visitDays === null || visitDays > 21 ? "washing" : !hasProtection ? "ceramic" : "washing";
  const cat = focus ?? autoFocus;
  const catSvc = (c: string): Service | undefined => {
    const list = catalogue.filter((x) => x.category === c).sort((a, b) => a.basePrice - b.basePrice);
    return c === "washing" ? list.find((x) => x.id === lastVisitServiceId) ?? list[0] : list[0];
  };
  const [chosen, setChosen] = useState<string | null>(null);
  useEffect(() => { setChosen(null); }, [cat]);
  useEffect(() => {
    setSlotsFor(null);
    const svc = catalogue.find((x) => x.id === chosen);
    if (!ready || !carId || !svc) return;
    let alive = true;
    void getAvailability(svc.id, FIRST_STUDIO_ID, todayIST(), 7)
      .then((sl) => { if (alive && sl.length > 0) setSlotsFor({ service: svc, slots: sl.slice(0, 3) }); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [ready, carId, chosen, catalogue]);
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
        <Skeleton height={300} />
        <Skeleton height={64} />
        <Skeleton height={96} />
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
      case "payInvoice":
        return m.dueInvoice
          ? router.push({ pathname: "/(tabs)/bookings/invoice", params: { jobId: m.dueInvoice.jobId, tenantId: auth.claims.tenantId, customerId: auth.user.uid } })
          : undefined;
      case "reviewProtection":
        return car ? router.push(`/(tabs)/garage/${car.id}`) : undefined;
    }
  };

  const header = (
    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
      <View style={{ flex: 1, gap: space.hair }}>
        <View style={{ alignSelf: "flex-start" }}><Logo onDark variant="mark" height={26} /></View>
        <T role="title">{greetingFor(new Date(), m.customer.firstName)}</T>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onPress={() => router.push("/(tabs)/notifications")}
        style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.borderSubtle, alignItems: "center", justifyContent: "center" }}
      >
        <Icon name="bell" color={colors.textSecondary} size={22} />
        {unread > 0 ? (
          <View style={{ position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />
        ) : null}
      </Pressable>
    </View>
  );

  return (
    <Screen header={header}>
      {home.error ? <T role="caption" tone="tertiary">{home.error}</T> : null}

      <StoryCircles groups={groups} seen={seen} onOpen={(g) => { setOpen(g); setSeen(new Set([...seen, g.key])); }} />
      <StoryViewer group={open} onClose={() => setOpen(null)} />

      {car && catalogue.length > 0 && !m.liveJob && !m.pendingApproval && !m.dueInvoice ? (() => {
        const dayName = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", { weekday: "short" });
        const go = (sl: AvailableSlot) => router.push({ pathname: "/(tabs)/book/confirm", params: { serviceId: slotsFor!.service.id, vehicleId: car.id, vehicleCategory: car.category ?? "hatchback", scheduledDate: sl.date, scheduledTime: sl.startTime, startAt: sl.startAt, estimatedEndAt: sl.estimatedEndAt, estimatedEndDate: sl.estimatedEndDate, endTime: sl.endTime } });
        const COPY = {
          washing: { title: visitDays !== null && visitDays > 21 ? "Time for a wash?" : "Keep it fresh", line: visitDays !== null ? `Last visit ${visitDays} day${visitDays === 1 ? "" : "s"} ago` : "Pick a wash for your car", name: "Washing" },
          ceramic: { title: `Protect your ${car.model}`, line: hasProtection ? "Add a fresh coat of gloss and protection" : "No paint protection on file yet", name: "Ceramic" },
          ppf: { title: `Shield your ${car.model}`, line: "Clear film against stone chips and scratches", name: "PPF" },
        }[cat];
        const options = catalogue.filter((x) => x.category === cat).sort((a, b) => a.basePrice - b.basePrice).slice(0, 4);
        const price = (x: Service) => (x as { priceOnRequest?: boolean }).priceOnRequest === true ? "On request" : `From ₹${Math.round(x.basePrice / 100).toLocaleString("en-IN")}`;
        const picked = options.find((x) => x.id === chosen);
        return (
          <FadeUp delay={120}>
            <Stage service={picked ?? options[0] ?? catSvc(cat)}>
              <View style={{ gap: space.line }}>
                <Kicker tone="accent">Suggested for you</Kicker>
                <T role="title">{COPY.title}</T>
                <T role="caption" tone="tertiary">{COPY.line}</T>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {(["washing", "ceramic", "ppf"] as const).filter((c) => catSvc(c)).map((c) => {
                    const on = c === cat;
                    return (
                      <Pressable key={c} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setFocus(c)} style={({ pressed }) => ({ borderRadius: 9999, backgroundColor: on ? "#EC8638" : "rgba(8,8,10,0.55)", paddingHorizontal: 16, paddingVertical: 8, transform: [{ scale: pressed ? 0.96 : 1 }], ...DISC_SHADOW })}>
                        <T role="bodyStrong" style={{ color: on ? "#1A1410" : "#E4E2DF" }}>{c === "washing" ? "Washing" : c === "ceramic" ? "Ceramic" : "PPF"}</T>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={{ gap: 8 }}>
                  {options.map((x) => {
                    const on = x.id === chosen;
                    return (
                      <Pressable key={x.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setChosen(on ? null : x.id)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderRadius: 18, borderWidth: 1.5, borderColor: on ? "#EC8638" : "rgba(255,255,255,0.10)", backgroundColor: on ? "rgba(236,134,56,0.22)" : "rgba(8,8,10,0.55)", paddingHorizontal: 14, paddingVertical: 12, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
                        <T role="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{x.name.replace(/^Kovalent\s+/i, "")}</T>
                        <T role="caption" tone="tertiary">{price(x)}</T>
                      </Pressable>
                    );
                  })}
                </View>
                {picked && slotsFor ? (
                  <View style={{ gap: 6 }}>
                    <T role="caption" tone="tertiary">Open times, or choose your own</T>
                    <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                      {slotsFor.slots.map((sl) => (
                        <Pressable key={sl.startAt} accessibilityRole="button" accessibilityLabel={`Book ${dayName(sl.date)} ${sl.startTime}`} onPress={() => go(sl)} style={({ pressed }) => ({ borderRadius: 9999, backgroundColor: "rgba(8,8,10,0.6)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", paddingHorizontal: 14, paddingVertical: 9, transform: [{ scale: pressed ? 0.96 : 1 }], ...DISC_SHADOW })}>
                          <T role="bodyStrong">{dayName(sl.date)} {sl.startTime}</T>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ) : null}
                <Button label={picked ? "Choose date and time" : "Choose a service"} onPress={() => (picked ? router.push(`/(tabs)/book/${picked.id}` as never) : router.push({ pathname: "/(tabs)/catalogue", params: { cat } }))} />
                <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/catalogue")} style={{ alignSelf: "center", paddingVertical: 4 }}>
                  <T role="caption" tone="accent">See all services</T>
                </Pressable>
              </View>
            </Stage>
          </FadeUp>
        );
      })() : null}

      <FadeUp>
      <Pressable accessibilityRole="button" accessibilityLabel={car ? `Open ${car.make} ${car.model}` : "Add your car"} onPress={() => (car ? router.push(`/(tabs)/garage/${car.id}`) : router.push("/(tabs)/garage/add"))} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ borderRadius: 32, overflow: "hidden", backgroundColor: "#2A2433", shadowColor: "#7A6FD0", shadowOpacity: 0.3, shadowRadius: 28, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
        <HeroImage aspect={3 / 2} source={carPhoto ? { uri: carPhoto } : car ? (car.category ? vehicleImagery[car.category] ?? sceneImagery.heroAlt : sceneImagery.heroAlt) : sceneImagery.heroHome} />
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(20,12,30,0.18)", ...({ backgroundImage: "linear-gradient(180deg, rgba(20,12,30,0.35) 0%, rgba(20,12,30,0) 30%, rgba(20,12,30,0.78) 100%)" } as object) }} />
        <View style={{ position: "absolute", left: space.inset, right: space.inset, bottom: space.inset, gap: 6 }}>
          <View style={{ alignSelf: "flex-start", borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 10, paddingVertical: 3 }}>
            <T role="caption" tone="accent">{copy.kicker}</T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: space.breath }}>
            {car ? (
              <View style={{ flex: 1, gap: 4 }}>
                <T role="heading" numberOfLines={1} style={{ color: "#FFFFFF" }}>{car.make} {car.model}</T>
                <View style={{ flexDirection: "row", gap: space.breath, alignItems: "center" }}>
                  <View style={{ borderRadius: 10, backgroundColor: "rgba(255,255,255,0.94)", paddingHorizontal: 6 }}><Plate value={car.registrationNumber} /></View>
                </View>
              </View>
            ) : (
              <T role="heading" style={{ color: "#FFFFFF", flex: 1 }}>Your garage is empty</T>
            )}
            <Button label={m.primaryAction.label} onPress={act} testID="home-primary" style={{ minHeight: 40, paddingHorizontal: 16 }} />
          </View>
        </View>
        {car ? (
          <View style={{ position: "absolute", top: space.inset, right: space.inset, flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9999, backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 12, paddingVertical: 6 }}>
            <T role="caption" tone="accent">Details</T>
            <T role="caption" tone="accent">›</T>
          </View>
        ) : null}
      </View>
      </Pressable>
      </FadeUp>

      {car || m.membership ? (
        <View style={{ flexDirection: "row", gap: space.line, alignItems: "stretch" }}>
          {(() => {
            const tile = (kicker: string, value: string, tone: "primary" | "accent" | "danger" | "premium", sub: string, onPress: () => void, label: string) => (
              <Pressable style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={label} onPress={onPress}>
                <Pane pad="inset">
                  <View style={{ height: 88, justifyContent: "flex-start", gap: 6 }}>
                    <Kicker>{kicker}</Kicker>
                    <T role="heading" tone={tone} numberOfLines={1}>{value}</T>
                    <T role="caption" tone="tertiary" numberOfLines={2}>{sub}</T>
                  </View>
                </Pane>
              </Pressable>
            );
            // Care status: one honest rule. Days since the last delivered visit (Fresh up to 21, Due soon up to 35, Overdue after),
            // raised by any expired or soon-to-expire paper or warranty. No score, no invented numbers.
            const last = m.recentHistory.find((j) => j.status === "DELIVERED")?.scheduledDate;
            const days = last ? Math.max(0, Math.round((Date.now() - new Date(last).getTime()) / 86400000)) : null;
            let level: 0 | 1 | 2 = days === null ? 1 : days <= 21 ? 0 : days <= 35 ? 1 : 2;
            let why = days === null ? "No visit on record yet" : days === 0 ? "Visited today" : `Last visit ${days} day${days === 1 ? "" : "s"} ago`;
            const expired = reminders.find((r) => r.danger);
            if (expired) { level = 2; why = `${expired.title} expired`; }
            else if (reminders[0] && level < 1) { level = 1; why = `${reminders[0].title} ends soon`; }
            const label = ["Fresh", "Due soon", "Overdue"][level] as string;
            return (
              <>
                {tile(
                  "Club",
                  m.membership ? `${m.membership.washesTotal - m.membership.washesUsed} of ${m.membership.washesTotal}` : "Join",
                  m.membership ? "primary" : "accent",
                  m.membership ? "washes left" : "Washes included",
                  () => router.push(m.membership ? "/(tabs)/membership/current" : "/(tabs)/membership"),
                  m.membership ? "Club membership" : "Join the club",
                )}
                {tile("Care status", label, level === 2 ? "danger" : level === 1 ? "accent" : "premium", why, () => (level > 0 ? router.push("/(tabs)/catalogue") : car ? router.push(`/(tabs)/garage/${car.id}`) : undefined), `Care status ${label}. ${why}`)}
              </>
            );
          })()}
        </View>
      ) : null}

      {m.pendingApproval || m.dueInvoice || m.liveJob || m.upcomingBooking ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            const bid = (m.liveJob as { bookingId?: string } | undefined)?.bookingId ?? m.upcomingBooking?.id;
            if (m.pendingApproval) router.push(`/(tabs)/approvals/${m.pendingApproval.id}`);
            else if (bid) router.push(`/(tabs)/bookings/${bid}`);
            else if (car) router.push(`/(tabs)/garage/${car.id}`);
          }}
        >
        <Pane pad="inset">
          <View style={{ gap: space.line }}>
            <Kicker tone="accent">{m.liveJob ? "Live now" : m.pendingApproval ? "Needs your OK" : m.dueInvoice ? "Bill ready" : "Next visit"}</Kicker>
            {m.pendingApproval ? (
              <Row title={m.pendingApproval.serviceName} detail={m.pendingApproval.reason} trailing={<T role="data" tone="accent">+{rupees(m.pendingApproval.priceImpact)}</T>} last />
            ) : m.dueInvoice ? (
              <Row title={m.dueInvoice.invoiceNumber} detail="Issued" trailing={<T role="data">{rupees(m.dueInvoice.total)}</T>} last />
            ) : m.liveJob ? (
              <View style={{ gap: space.line }}>
                <Row title={JOB_STAGE[m.liveJob.status] ?? "In the studio"} detail={`Since ${new Date(m.liveJob.scheduledAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`} last />
                <StatusRail status={m.liveJob.status} />
              </View>
            ) : m.upcomingBooking ? (
              <Row title={`${formatDateShort(m.upcomingBooking.scheduledDate)} · ${m.upcomingBooking.scheduledTime}`} detail={m.upcomingBooking.status === "PENDING" ? "Waiting for the studio to confirm" : "Confirmed"} last />
            ) : null}
          </View>
        </Pane>
        </Pressable>
      ) : null}

      {catalogue.length === 0 && catalogueFailed ? (
        <Notice title="Services didn't load" body="Check your connection and try again." action={<Button kind="quiet" label="Retry" onPress={() => { setCatalogueFailed(false); setRetryTick((n) => n + 1); }} />} />
      ) : catalogue.length === 0 ? (
        <View style={{ gap: space.line }}><Skeleton height={28} width="50%" /><Skeleton height={220} /></View>
      ) : null}

      {picks.length > 0 ? (
        <View style={{ gap: space.breath }}>
          <View style={{ gap: 2 }}>
            <Kicker tone="accent">Care</Kicker>
            <T role="title">{car ? `Made for your ${car.model}` : "Popular services"}</T>
            <T role="caption" tone="tertiary">Swipe through care picked for {car ? "this car" : "you"}</T>
          </View>
          <DepthCarousel items={picks} carName={car?.model} onOpen={(sv) => router.push(`/(tabs)/catalogue/${sv.id}`)} />
        </View>
      ) : null}

      <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/cars")}>
        <Pane pad="inset">
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.line }}>
            <View style={{ flex: 1, gap: space.hair }}>
              <Kicker tone="accent">Cars for sale</Kicker>
              <T role="heading">Buy or sell a car</T>
              <T role="caption" tone="tertiary">Browse cars, or list yours for review</T>
            </View>
            <Icon name="car" color={colors.accent} size={28} />
          </View>
        </Pane>
      </Pressable>

      {reminders.length > 0 ? (
        <View style={{ gap: space.line }}>
          <Kicker>Reminders</Kicker>
          <Pane pad="gap">
            {reminders.map((r, i) => (
              <Row key={r.title} title={r.title} detail={r.detail} trailing={<Chip label={r.chip} tone={r.danger ? "danger" : "accent"} />} onPress={() => router.push(`/(tabs)/garage/${carId}`)} last={i === reminders.length - 1} />
            ))}
          </Pane>
        </View>
      ) : null}

      {!m.membership && !car ? (
        <Pressable onPress={() => router.push("/(tabs)/membership")}>
          <Pane pad="inset" fill="cool" tone="premium">
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.line }}>
              <View style={{ flex: 1, gap: space.hair }}>
                <Kicker tone="premium">Club</Kicker>
                <T role="heading">Washes included, care for less</T>
                <T role="caption" tone="tertiary">See membership plans</T>
              </View>
              <T tone="accent">›</T>
            </View>
          </Pane>
        </Pressable>
      ) : null}

      {m.membership && !car ? (
        <View style={{ gap: space.line }}>
          <Kicker tone="premium">Membership</Kicker>
          <Pane pad="inset" fill="cool" tone="premium">
            <Pressable onPress={() => router.push("/(tabs)/membership/current")} style={{ gap: space.breath }}>
              <T role="heading" style={{ textTransform: "capitalize" }}>{m.membership.tier} club</T>
              <T tone="secondary">
                {m.membership.washesTotal - m.membership.washesUsed} of {m.membership.washesTotal} washes left · {m.membership.discountPercent}% off care
              </T>
            </Pressable>
          </Pane>
        </View>
      ) : null}

      {m.recentHistory.length > 0 ? (
        <View style={{ gap: space.line }}>
          <Kicker>Recent visits</Kicker>
          <Pane pad="gap">
            {m.recentHistory.map((j, i, arr) => (
              <Row
                key={j.id}
                title={formatDateShort(j.scheduledDate)}
                detail={JOB_STAGE[j.status]}
                trailing={<T role="data" tone="secondary">{rupees(j.totalAmount)}</T>}
                onPress={j.bookingId ? () => router.push(`/(tabs)/bookings/${j.bookingId}`) : undefined}
                last={i === arr.length - 1}
              />
            ))}
          </Pane>
          <Button kind="quiet" label="Book another service" onPress={() => router.push("/(tabs)/catalogue")} />
        </View>
      ) : null}

      {m.otherVehicles.length > 0 ? (
        <Button kind="quiet" label={`Switch car (${m.otherVehicles.length + 1} in garage)`} onPress={() => router.push("/(tabs)/garage")} />
      ) : null}

      {!car ? (
        <Notice title="Explore first" body="Browse services and prices now. You'll only need a car on file when you book." action={<Button kind="quiet" label="See services" onPress={() => router.push("/(tabs)/catalogue")} />} />
      ) : null}
    </Screen>
  );
}
