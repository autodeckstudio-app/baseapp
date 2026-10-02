// Home: vehicle-first, one lead state (spec §6.2). What leads is decided by
// projectCustomerHome from the customer's own records - never invented here.
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { greetingFor, type CustomerHomeModel } from "@autodeck/core";
import { ExperienceThemeProvider, Icon, useExperienceTheme } from "@autodeck/ui/native";
import { space } from "@autodeck/ui/theme";
import { formatDateShort } from "@autodeck/ui";
import { useAuth } from "../../hooks/useAuth";
import { useCustomerHome } from "../../hooks/useCustomerHome";
import { sceneImagery, vehicleImagery } from "../../lib/imagery";
import { resolveVehiclePhotoUrl } from "../../lib/vehicle-service";
import { listenToMyNotifications } from "../../lib/notification-service";
import { listenToVehiclePapers, daysUntil, type MyPaper } from "../../lib/paper-service";
import { listenToVehicleWarranties } from "../../lib/warranty-service";
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

export default function HomeScreen() {
  const auth = useAuth();
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const ready = auth.status === "ready";
  const home = useCustomerHome(ready ? auth.user.uid : null, ready ? auth.claims.tenantId : null, ready ? auth.user.displayName : null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!ready) return;
    return listenToMyNotifications(auth.claims.tenantId, auth.user.uid, (n) => setUnread(n.filter((x) => x.readAt === null).length), () => undefined);
  }, [ready]);

  const [carPhoto, setCarPhoto] = useState<string | null>(null);
  const photoPath = ready ? home.model?.activeVehicle?.photoUrl ?? null : null;
  useEffect(() => {
    let alive = true;
    setCarPhoto(null);
    if (photoPath) {
      void resolveVehiclePhotoUrl(photoPath)
        .then((u) => { if (alive) setCarPhoto(u); })
        .catch(() => undefined);
    }
    return () => { alive = false; };
  }, [photoPath]);

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
        <Kicker tone="accent">AutoDeck</Kicker>
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

      <View style={{ borderRadius: 28, overflow: "hidden", backgroundColor: "#F3E6F5", ...({ backgroundImage: "linear-gradient(160deg, #C9D0F5 0%, #F6DCE6 55%, #FFD9B8 100%)" } as object), shadowColor: "#7A6FD0", shadowOpacity: 0.25, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 }}>
        <ExperienceThemeProvider name="light">
        <HeroImage source={carPhoto ? { uri: carPhoto } : car ? (car.category ? vehicleImagery[car.category] ?? sceneImagery.heroAlt : sceneImagery.heroAlt) : sceneImagery.heroHome} />
        <View style={{ padding: space.inset, gap: space.line }}>
          <Kicker tone="accent">{copy.kicker}</Kicker>
          {car ? (
            <View style={{ gap: space.breath }}>
              <T role="display" numberOfLines={1}>{car.make} {car.model}</T>
              <View style={{ flexDirection: "row", gap: space.breath, alignItems: "center" }}>
                <Plate value={car.registrationNumber} />
                <T role="caption" tone="tertiary">{car.year}{car.color ? ` · ${car.color}` : ""}</T>
              </View>
            </View>
          ) : (
            <T role="display">Your garage is empty</T>
          )}
          <T tone="secondary">{copy.line}</T>

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

          <Button label={m.primaryAction.label} onPress={act} testID="home-primary" />
        </View>
              </ExperienceThemeProvider>
      </View>

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

      {!m.membership ? (
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

      {m.membership ? (
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
