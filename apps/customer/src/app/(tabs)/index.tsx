// Home: vehicle-first, one lead state (spec §6.2). What leads is decided by
// projectCustomerHome from the customer's own records - never invented here.
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { greetingFor, type CustomerHomeModel } from "@autodeck/core";
import { FadeUp, Icon, Logo, useExperienceTheme } from "@autodeck/ui/native";
import { space } from "@autodeck/ui/theme";
import { formatDateShort } from "@autodeck/ui";
import { useAuth } from "../../hooks/useAuth";
import { useCustomerHome } from "../../hooks/useCustomerHome";
import { sceneImagery, vehicleImagery, serviceImagery } from "../../lib/imagery";
import { useVehiclePhotoUri } from "../../ui/CarThumb";
import { listenToMyNotifications } from "../../lib/notification-service";
import { listenToVehiclePapers, daysUntil, type MyPaper } from "../../lib/paper-service";
import { listenToVehicleWarranties } from "../../lib/warranty-service";
import type { Service } from "@autodeck/core";
import { getServiceCatalogue} from "../../lib/catalogue-service";
import { getStories, groupStories, type StoryGroup } from "../../lib/story-service";
import { StoryCircles } from "../../ui/StoryCircles";
import { priceLabel } from "../../lib/catalogue-service";
import { StoryViewer } from "../../ui/StoryViewer";
import { HeroImage, Button, Chip, Kicker, Notice, Pane, Plate, Row, Screen, Skeleton, T, rupees } from "../../ui/kit";

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
  const home = useCustomerHome(ready ? auth.user.uid : null, ready ? auth.claims.tenantId : null, ready ? auth.user.displayName : null);
  const [unread, setUnread] = useState(0);
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [open, setOpen] = useState<StoryGroup | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [catalogueFailed, setCatalogueFailed] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [catalogue, setCatalogue] = useState<Service[]>([]);
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

  const carPhoto = useVehiclePhotoUri(ready ? home.model?.activeVehicle : null);
  const carId = ready ? home.model?.activeVehicle?.id ?? null : null;
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

      <FadeUp>
      <Pressable accessibilityRole="button" accessibilityLabel={car ? `Open ${car.make} ${car.model}` : "Add your car"} onPress={() => (car ? router.push(`/(tabs)/garage/${car.id}`) : router.push("/(tabs)/garage/add"))} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ borderRadius: 32, overflow: "hidden", backgroundColor: "#0B0B0D", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", shadowColor: "#EC8638", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 14 }, elevation: 8 }}>
        {car?.photoUrl && !carPhoto ? <View style={{width: "100%", aspectRatio: 16 / 10, backgroundColor: "#161618"}} /> : <HeroImage aspect={16 / 10} source={carPhoto ? { uri: carPhoto } : car ? (car.category ? vehicleImagery[car.category] ?? sceneImagery.heroAlt : sceneImagery.heroAlt) : sceneImagery.heroHome} />}
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(20,12,30,0.18)", ...({ backgroundImage: "linear-gradient(180deg, rgba(8,8,10,0.45) 0%, rgba(8,8,10,0) 28%, rgba(8,8,10,0.9) 100%)" } as object) }} />
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
      <Button label={m.primaryAction.label} onPress={act} testID="home-primary" />

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

      {groups.length > 0 ? <StoryCircles groups={groups} seen={seen} onOpen={(g) => { setOpen(g); setSeen(new Set([...seen, g.key])); }} /> : null}
      <StoryViewer group={open} onClose={() => setOpen(null)} />

      <View style={{gap: space.gap}}>
        <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between"}}>
          <View style={{gap:4}}><Kicker>Care for your car</Kicker><T role="heading">Keep it at its best</T></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Browse all services" onPress={() => router.push("/(tabs)/catalogue")} style={{minHeight:44,justifyContent:"center"}}><T tone="accent">See all ›</T></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:12,paddingBottom:8}}>
          {["washing", "ceramic", "ppf"].map(category => {
            const candidates = catalogue.filter(x => x.category === category);
            const service = [...candidates].sort((a,b) => a.basePrice-b.basePrice)[0];
            if (!service) return null;
            return <Pressable key={category} accessibilityRole="button" accessibilityLabel={`Explore ${category} services`} onPress={() => router.push({pathname:"/(tabs)/catalogue",params:{cat:category}})} style={{width:216,gap:10}}>
              <View style={{borderRadius:20,overflow:"hidden"}}><HeroImage aspect={3/2} source={serviceImagery[category as keyof typeof serviceImagery]} /></View>
              <T role="bodyStrong">{category === "washing" ? "Wash and care" : category === "ceramic" ? "Ceramic protection" : "Paint protection film"}</T>
              <T role="caption" tone="tertiary">{service.priceOnRequest ? "Explore options" : `From ${priceLabel(service)}`}</T>
            </Pressable>;
          })}
        </ScrollView>
      </View>
      <View style={{gap:space.line}}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><Kicker>Your garage</Kicker><Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/garage")} style={{minHeight:44,justifyContent:"center"}}><T tone="accent">Manage ›</T></Pressable></View>
        <Pane pad="gap">
          {car ? [car,...m.otherVehicles].slice(0,3).map((v,i,vs) => <Row key={v.id} title={`${v.make} ${v.model}`} detail={v.id===car.id ? "Current vehicle · papers and protection" : "Vehicle details and papers"} trailing={<Plate value={v.registrationNumber}/>} onPress={() => router.push(`/(tabs)/garage/${v.id}`)} last={i===vs.length-1}/>) : <Row title="Your cars, together" detail="Add your vehicle to keep visits and papers in one place." onPress={() => router.push("/(tabs)/garage/add")} last/>}
        </Pane>
      </View>
      <View style={{gap:space.line}}>
        <Kicker>With AutoDeck</Kicker>
        <Pane pad="gap">
          <Row title={m.membership ? "Your membership" : "Make regular care simpler"} detail={m.membership ? "Wash benefits and usage" : "Explore wash memberships"} onPress={() => router.push(m.membership ? "/(tabs)/membership/current" : "/(tabs)/membership")}/>
          <Row title="Find your next car" detail="Browse cars or list yours for studio review" onPress={() => router.push("/(tabs)/cars")} last/>
        </Pane>
      </View>
      {m.recentHistory.length > 0 ? <View style={{gap:space.line}}><Kicker>Recent activity</Kicker><Pane pad="gap">{m.recentHistory.slice(0,2).map((job,i,js) => <Row key={job.id} title={catalogue.find(x=>x.id===job.serviceId)?.name ?? "Studio visit completed"} detail={formatDateShort(job.scheduledDate)} trailing={<Chip label="Delivered"/>} onPress={() => job.bookingId ? router.push(`/(tabs)/bookings/${job.bookingId}`) : router.push("/(tabs)/bookings")} last={i===js.length-1}/>)}</Pane></View> : null}

      {catalogue.length === 0 && catalogueFailed ? (
        <Notice title="Services didn't load" body="Check your connection and try again." action={<Button kind="quiet" label="Retry" onPress={() => { setCatalogueFailed(false); setRetryTick((n) => n + 1); }} />} />
      ) : catalogue.length === 0 ? (
        <View style={{ gap: space.line }}><Skeleton height={28} width="50%" /><Skeleton height={220} /></View>
      ) : null}

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


      {!car ? (
        <Notice title="Explore first" body="Browse services and prices now. You'll only need a car on file when you book." action={<Button kind="quiet" label="See services" onPress={() => router.push("/(tabs)/catalogue")} />} />
      ) : null}
    </Screen>
  );
}
