import { TabPills } from "../../../ui/CarOverview";
import { usePricingVehicle } from "../../../lib/vehicle-size";
import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import type { ReactNode } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { isSizePriced, needsInspectionNote, PAINT_INSPECTION_NOTE, resolvePricingCategory, type Service, type VehicleCategory, type PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space} from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { stickyPriceLabel } from "../../../lib/sticky-price";
import { ServicePrice } from "../../../ui/ServicePrice";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { COPY_IS_DRAFT, SHOW_BEFORE_AFTER, FAQS, showcaseFor } from "../../../lib/showcase";
import { getServiceReviews, type ServiceReviews } from "../../../lib/review-service";
import { FIRST_STUDIO_ID, GST_ENABLED } from "@autodeck/core";
import { getAvailability, todayIST } from "../../../lib/booking-service";
import { applyBrandWarranty, getServiceCatalogue, priceLabel } from "../../../lib/catalogue-service";


export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const auth = useAuth();
  const pricingVehicle = usePricingVehicle();
  // The size comes only from the selected car's saved type (edited in Garage). Flat-priced services do not depend on size, so the server
  // only needs a valid value there; size-priced (PPF) with no saved type has no price until the type is saved. Never a guessed size.
  const selectedCategory: VehicleCategory | null = pricingVehicle.category ?? (service && !isSizePriced(service.category) ? "hatchback" : null);
  const needsCarType = !!service && isSizePriced(service.category) && !pricingVehicle.category;
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdownData | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [priceTry, setPriceTry] = useState(0);
  const [reviews, setReviews] = useState<ServiceReviews | null>(null);

  useEffect(() => {
    if (!id) return;
    void (async () => {
      try {
        const snap = await getDoc(doc(db, COLLECTIONS.services(), id));
        if (snap.exists()) setService(applyBrandWarranty(snap.data() as Service));
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  useEffect(() => {
    setPriceBreakdown(null);
    if (!id || !service || !selectedCategory) {setPriceLoading(false);return;}
    const category=selectedCategory;
    setPriceLoading(true);
    setPriceError(null);
    let stale = false;
    const ask = () => calculateServicePrice(id, category);
    void ask()
      .catch(() => new Promise<Awaited<ReturnType<typeof ask>>>((resolve, reject) => setTimeout(() => ask().then(resolve, reject), 900)))
      .then(({ breakdown }) => { if (!stale) setPriceBreakdown(breakdown); })
      .catch((e: unknown) => { if (!stale) setPriceError(String((e as { code?: string } | null)?.code ?? "unknown")); })
      .finally(() => { if (!stale) setPriceLoading(false); });
    return () => { stale = true; };
  }, [id, service, selectedCategory, priceTry]);

  // Warm the studio calendar so Book opens with times already there.
  useEffect(() => {
    if (!service || service.priceOnRequest === true) return;
    void getAvailability(service.id, FIRST_STUDIO_ID, todayIST(), 7).catch(() => undefined);
  }, [service]);

  useEffect(() => {
    if (!service) return;
    void getServiceReviews(service.id).then(setReviews).catch(() => setReviews(null));
  }, [service]);

  return (
    <ServiceDetailView
      id={id}
      service={service}
      loading={loading}
      loadError={loadError}
      reviews={reviews}
      pricingVehicle={pricingVehicle}
      selectedCategory={selectedCategory}
      needsCarType={needsCarType}
      priceLoading={priceLoading}
      priceError={priceError}
      priceBreakdown={priceBreakdown}
      onRetry={() => setPriceTry((n) => n + 1)}
    />
  );
}

export type ServiceDetailViewProps = {
  id: string | undefined;
  service: Service | null;
  loading: boolean;
  loadError: boolean;
  reviews: ServiceReviews | null;
  pricingVehicle: { vehicle: { id: string; make?: string; model?: string } | null; label: string | null | undefined; category: VehicleCategory | null };
  selectedCategory: VehicleCategory | null;
  needsCarType: boolean;
  priceLoading: boolean;
  priceError: string | null;
  priceBreakdown: PriceBreakdownData | null;
  onRetry: () => void;
};

/** Everything on screen for one service. The screen above only gathers data, so this renders the same with fixed fixtures in the dev preview. */
export function ServiceDetailView(props: ServiceDetailViewProps) {
  const { id, service, loading, loadError, reviews, pricingVehicle, selectedCategory, needsCarType, priceLoading, priceError, priceBreakdown, onRetry } = props;
  const router = useRouter();
  // The price bar is positioned over the whole page, so it must go away when another screen opens on top (Book now).
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const { colors, name: mode } = useExperienceTheme();
  const [after, setAfter] = useState(true);
  const [tab, setTab] = useState<"overview" | "includes">("overview");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  if (loading) return <Loading label="Opening the menu" />;
  if (loadError) return <Screen><Notice title="Can't load this service" body="Check your connection and try again." /></Screen>;
  if (!service) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." /></Screen>;

  const sc = showcaseFor(service);
  const faqs = FAQS[service.category] ?? FAQS.washing ?? [];
  const H = (t: string, extra?: ReactNode) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Kicker>{t}</Kicker>
      {extra}
    </View>
  );
  const mins = service.estimatedDurationMinutes;
  const dur = mins < 60 ? `${mins} min` : mins >= 480 ? `${Math.round(mins / 480)} day${mins >= 960 ? "s" : ""}` : `${Number.isInteger(mins / 60) ? mins / 60 : (mins / 60).toFixed(1)} hr`;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <View style={{ gap: space.hair }}>
            <Kicker tone="accent">{service.category}</Kicker>
            <T role="title">{service.name}</T>
            {pricingVehicle.label ? <T role="caption" tone="accent">Prices for your {pricingVehicle.vehicle?.make} {pricingVehicle.vehicle?.model} · {pricingVehicle.label}</T> : null}
            {service.brand !== null ? <T role="caption" tone="secondary">{service.brand}</T> : null}
          </View>
        }
      >
        <Pane pad="none">
          <ServicePhoto service={service} aspect={4 / 3} radius={26} />
        </Pane>

        <TabPills tabs={[{ key: "overview", label: "Overview" }, { key: "includes", label: "Includes" }]} value={tab} onChange={setTab} />

        {tab === "overview" ? (
          <>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath, alignItems: "center" }}>
          {sc.studioPick ? <Chip label="Studio pick" tone="accent" /> : null}
          {service.warrantyLabel !== null ? <Chip label={service.warrantyLabel} tone="premium" /> : null}
          <Chip label={dur} />
          {service.brand !== null ? <Chip label={service.brand} /> : null}
        </View>

        <T role="heading">{sc.tagline || service.description}</T>
        {sc.tagline && sc.tagline !== service.description ? <T tone="secondary">{service.description}</T> : null}
        {service.priceEstimate ? <T role="caption" tone="tertiary">Estimated price. The studio confirms the final amount before work starts.</T> : null}

        {reviews && reviews.count > 0 ? (
          <View style={{ gap: space.breath }}>
            {H("Customer reviews", <Chip label={`${reviews.average?.toFixed(1)} from ${reviews.count} rating${reviews.count === 1 ? "" : "s"}`} tone="premium" />)}
            {reviews.recent.length > 0 ? (
              <Pane pad="gap">
                {reviews.recent.map((r, i) => (
                  <Row
                    key={`${r.date}-${i}`}
                    title={<View style={{ flexDirection: "row", gap: 2 }}>{[1, 2, 3, 4, 5].map((n) => <Icon key={n} name="star" color={n <= r.rating ? colors.accent : colors.borderStrong} size={14} />)}</View>}
                    detail={r.comment}
                    last={i === reviews.recent.length - 1}
                  />
                ))}
              </Pane>
            ) : null}
          </View>
        ) : null}

        {SHOW_BEFORE_AFTER ? <View style={{ gap: space.breath }}>
          {H("Before and after", <Chip label="Placeholder photos" tone="danger" />)}
          <Pane pad="none">
            <View style={{ position: "relative" }}>
              <ServicePhoto service={service} aspect={4 / 3} radius={26} />
              {!after ? <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(10,10,12,0.55)" }} /> : null}
            </View>
            <View style={{ flexDirection: "row", gap: space.breath, padding: space.line }}>
              {[{ k: false, l: "Before" }, { k: true, l: "After" }].map(({ k, l }) => (
                <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: after === k }} onPress={() => setAfter(k)} style={{ flex: 1, alignItems: "center", borderRadius: 9999, borderWidth: 1, borderColor: after === k ? colors.accent : colors.borderSubtle, backgroundColor: after === k ? colors.accentHaze : "transparent", paddingVertical: 8 }}>
                  <T role="caption" tone={after === k ? "accent" : "secondary"}>{l}</T>
                </Pressable>
              ))}
            </View>
          </Pane>
          <T role="caption" tone="tertiary">Stock image for layout only. Real studio before and after photos go here.</T>
        </View> : null}

        <View style={{ gap: space.line }}>
          {H(service.category === "garage" ? "Price" : "Price for your car")}

          <ServicePrice category={service.category} priceOnRequest={service.priceOnRequest === true} needsCarType={needsCarType} hasCar={!!pricingVehicle.vehicle} carSizeKnown={!!selectedCategory} loading={priceLoading} error={priceError} breakdown={priceBreakdown} onRetry={onRetry} onGarage={() => router.push(pricingVehicle.vehicle ? `/(tabs)/garage/${pricingVehicle.vehicle.id}` : "/(tabs)/garage/add")} />
        </View>

          </>
        ) : null}

        {tab === "includes" ? (
          <>
        {sc.included.length > 0 ? (
          <View style={{ gap: space.breath }}>
            {H("What's included")}
            <Pane pad="gap">
              {sc.included.map((x, i) => (
                <Row key={x} title={<View style={{ flexDirection: "row", gap: space.line }}><Icon name="check" color={colors.accent} size={18} /><View style={{ flex: 1 }}><T>{x}</T></View></View>} last={i === sc.included.length - 1} />
              ))}
            </Pane>
          </View>
        ) : null}

        {sc.benefits.length > 0 ? (
          <View style={{ gap: space.breath }}>
            {H("Why people choose it")}
            <Pane pad="gap">
              {sc.benefits.map((x, i) => (
                <Row key={x} title={<View style={{ flexDirection: "row", gap: space.line }}><Icon name="ceramic" color={colors.accent} size={18} /><View style={{ flex: 1 }}><T>{x}</T></View></View>} last={i === sc.benefits.length - 1} />
              ))}
            </Pane>
          </View>
        ) : null}

        {(service.careTips ?? []).length > 0 ? (
          <View style={{ gap: space.breath }}>
            {H("Care tips")}
            <Pane pad="gap">
              {(service.careTips ?? []).map((x, i, arr) => (
                <Row key={`${i}-${x}`} title={x} last={i === arr.length - 1} />
              ))}
            </Pane>
          </View>
        ) : null}

        <View style={{ gap: space.breath }}>
          {H("Questions")}
          <Pane pad="gap">
            {faqs.map((f, i) => (
              <Row
                key={f.q}
                title={f.q}
                detail={openFaq === i ? <T role="caption" tone="secondary">{f.a}</T> : undefined}
                trailing={<T tone="tertiary">{openFaq === i ? "−" : "+"}</T>}
                onPress={() => setOpenFaq(openFaq === i ? null : i)}
                last={i === faqs.length - 1}
              />
            ))}
          </Pane>
        </View>

          </>
        ) : null}

        {COPY_IS_DRAFT ? <T role="caption" tone="tertiary">Draft text, pending studio review.</T> : null}
        <View style={{ height: 220 }} />
      </Screen>
      {focused ? <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 92, alignItems: "center", paddingHorizontal: 20 }}><View style={{ width: "100%", maxWidth: 480, alignItems: "center", paddingHorizontal: space.inset, paddingVertical: space.line, backgroundColor: mode === "light" ? "#FFFFFF" : "#1B1B1F", borderRadius: 24, borderWidth: 1, borderColor: mode === "light" ? "rgba(60,48,36,0.10)" : "rgba(255,255,255,0.08)", shadowColor: "#000", shadowOpacity: mode === "light" ? 0.14 : 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        <View style={{ width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "center", gap: space.inset }}>
          <View style={{ flex: 1 }}>
            <T role="caption" tone="tertiary">{pricingVehicle.label ?? "Your car"}{GST_ENABLED ? " · incl. GST" : ""}</T>
            <T role="heading">{stickyPriceLabel({ priceOnRequest: service.priceOnRequest === true, loading: priceLoading, total: priceBreakdown ? priceBreakdown.total : null, from: service.priceFrom === true, needsCarType, hasCar: !!pricingVehicle.vehicle, error: priceError !== null }, rupees)}</T>
          </View>
          <View style={{ flex: 1.4 }}>
            <Button label={service.priceOnRequest === true ? (service.category === "garage" || service.category === "modifications" ? "Book an inspection" : "Request a quote") : "Book now"} onPress={() => router.push(`/(tabs)/book/${id}`)} />
          </View>
        </View>
      </View></View> : null}
    </View>
  );
}
