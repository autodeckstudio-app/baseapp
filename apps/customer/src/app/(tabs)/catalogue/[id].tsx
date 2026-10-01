import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import type { ReactNode } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import type { Service, VehicleCategory, PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space, type IconName } from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { HeroImage, Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T, rupees } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { serviceImagery } from "../../../lib/imagery";
import { COPY_IS_DRAFT, FAQS, showcaseFor } from "../../../lib/showcase";
import { getServiceReviews, type ServiceReviews } from "../../../lib/review-service";
import { applyBrandWarranty, getServiceCatalogue, priceLabel } from "../../../lib/catalogue-service";

const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "luxury", label: "Luxury / Premium" },
  { value: "van", label: "Van / MUV" },
  { value: "commercial", label: "Commercial" },
];

export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useExperienceTheme();
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const auth = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory>("hatchback");
  const [pickedSize, setPickedSize] = useState(false);
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdownData | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState(false);
  const [siblings, setSiblings] = useState<Service[]>([]);
  const [after, setAfter] = useState(true);
  const [reviews, setReviews] = useState<ServiceReviews | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Default the price chip to the size of the customer's first saved car (until they pick one).
  useEffect(() => {
    if (auth.status !== "ready" || pickedSize) return;
    return listenToMyVehicles(auth.user.uid, auth.claims.tenantId, (vs) => {
      const first = vs[0];
      if (first && !pickedSize) setSelectedCategory(first.category as VehicleCategory);
    }, () => undefined);
  }, [auth.status, pickedSize]);

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
    if (!id || !service) return;
    setPriceLoading(true);
    setPriceError(false);
    void calculateServicePrice(id, selectedCategory)
      .then(({ breakdown }) => setPriceBreakdown(breakdown))
      .catch(() => setPriceError(true))
      .finally(() => setPriceLoading(false));
  }, [id, service, selectedCategory]);

  useEffect(() => {
    if (!service) return;
    void getServiceCatalogue().then((all) => setSiblings(all.filter((x) => x.category === service.category).sort((a, b) => a.basePrice - b.basePrice))).catch(() => undefined);
  }, [service]);

  useEffect(() => {
    if (!service) return;
    void getServiceReviews(service.id).then(setReviews).catch(() => setReviews(null));
  }, [service]);

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
            {service.brand !== null ? <T role="caption" tone="secondary">{service.brand}</T> : null}
          </View>
        }
      >
        <Pane pad="none">
          <HeroImage source={serviceImagery[service.category] ?? serviceImagery.other} />
        </Pane>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath, alignItems: "center" }}>
          {sc.studioPick ? <Chip label="Studio pick" tone="accent" /> : null}
          {service.warrantyLabel !== null ? <Chip label={service.warrantyLabel} tone="premium" /> : null}
          <Chip label={dur} />
          {service.brand !== null ? <Chip label={service.brand} /> : null}
        </View>

        <T role="heading">{sc.tagline || service.description}</T>
        {sc.tagline && sc.tagline !== service.description ? <T tone="secondary">{service.description}</T> : null}
        {service.priceEstimate ? <T role="caption" tone="tertiary">Estimated price. The studio confirms the final amount before work starts.</T> : null}

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

        <View style={{ gap: space.breath }}>
          {H("Before and after", <Chip label="Placeholder photos" tone="danger" />)}
          <Pane pad="none">
            <View style={{ position: "relative" }}>
              <HeroImage source={serviceImagery[service.category] ?? serviceImagery.other} aspect={16 / 9} />
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
        </View>

        <View style={{ gap: space.line }}>
          {H("Price for your car")}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
            {VEHICLE_CATEGORIES.map(({ value, label }) => {
              const selected = selectedCategory === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => { setPickedSize(true); setSelectedCategory(value); }}
                  style={{ borderRadius: 9999, borderWidth: 1, borderColor: selected ? colors.accent : colors.borderSubtle, backgroundColor: selected ? colors.accentHaze : "transparent", paddingHorizontal: 14, paddingVertical: 8 }}
                >
                  <T role="caption" tone={selected ? "accent" : "secondary"}>{label}</T>
                </Pressable>
              );
            })}
          </View>

          {service.priceOnRequest === true ? (
            <Pane pad="gap"><Row title="Quote on request" detail={<T role="caption" tone="secondary">The studio confirms the price for your car. You approve it before any work starts.</T>} last /></Pane>
          ) : priceLoading ? (
            <T role="caption" tone="tertiary">Working out the price...</T>
          ) : priceError ? (
            <Notice title="Can't get the price" body="Check your connection and try again." />
          ) : priceBreakdown !== null ? (
            <Pane pad="gap">
              <Row title="Base" trailing={<T role="data">{rupees(priceBreakdown.basePrice)}</T>} />
              {priceBreakdown.scopeAdjustment > 0 ? (
                <Row title="Vehicle size adjustment" trailing={<T role="data">+{rupees(priceBreakdown.scopeAdjustment)}</T>} />
              ) : null}
              {priceBreakdown.addOns.map((addOn) => (
                <Row key={addOn.id} title={addOn.name} trailing={<T role="data">{rupees(addOn.price)}</T>} />
              ))}
              {priceBreakdown.membershipDiscount !== null && priceBreakdown.membershipDiscount > 0 ? (
                <Row title="Membership discount" trailing={<T role="data" tone="premium">-{rupees(priceBreakdown.membershipDiscount)}</T>} />
              ) : null}
              <Row title={priceBreakdown.taxDescription} trailing={<T role="data">{rupees(priceBreakdown.tax)}</T>} />
              <Row title={<T role="heading">Total</T>} trailing={<T role="heading">{rupees(priceBreakdown.total)}</T>} last />
            </Pane>
          ) : null}
        </View>

        {siblings.length > 1 ? (
          <View style={{ gap: space.breath }}>
            {H("Compare options")}
            <Pane pad="gap">
              {siblings.map((x, i) => (
                <Row
                  key={x.id}
                  title={x.id === service.id ? `${x.name} (you're here)` : x.name}
                  detail={<T role="caption" tone="tertiary">{[x.brand, x.warrantyLabel].filter(Boolean).join(" · ") || "No warranty listed"}</T>}
                  trailing={<T role="bodyStrong" tone={x.id === service.id ? "accent" : "secondary"}>{priceLabel(x)}</T>}
                  onPress={x.id === service.id ? undefined : () => router.replace(`/(tabs)/catalogue/${x.id}`)}
                  last={i === siblings.length - 1}
                />
              ))}
            </Pane>
          </View>
        ) : null}

        {sc.care.length > 0 ? (
          <View style={{ gap: space.breath }}>
            {H("Care tips")}
            <Pane pad="gap">
              {sc.care.map((x, i) => (
                <Row key={x} title={x} last={i === sc.care.length - 1} />
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

        {COPY_IS_DRAFT ? <T role="caption" tone="tertiary">Draft text, pending studio review.</T> : null}
        <View style={{ height: 180 }} />
      </Screen>
      <View style={{ position: "absolute", left: 0, right: 0, marginHorizontal: "auto" as unknown as number, bottom: 92, alignItems: "center", paddingHorizontal: space.inset, paddingVertical: space.line, backgroundColor: "#FFFFFF", borderRadius: 24, maxWidth: 480, width: "92%", alignSelf: "center", shadowColor: "#7A6FD0", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        <View style={{ width: "100%", maxWidth: 560, flexDirection: "row", alignItems: "center", gap: space.inset }}>
          <View style={{ flex: 1 }}>
            <T role="caption" tone="tertiary">From</T>
            <T role="heading">{priceLabel(service)}</T>
          </View>
          <View style={{ flex: 1.4 }}>
            <Button label={service.priceOnRequest === true ? "Request a quote" : "Book now"} onPress={() => router.push(`/(tabs)/book/${id}`)} />
          </View>
        </View>
      </View>
    </View>
  );
}
