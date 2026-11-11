import { SERVICE_HOMES } from "@autodeck/core";
import { servicePlacement } from "../../../lib/services-navigation";
import{ServicePageHeader}from"../../../ui/ServicePageHeader";
import { customerOfferingVisible } from '../../../lib/customer-offering-visibility';
import{SERVICE_QUOTE_JOURNEY_READY}from "../../../lib/service-quote";
import { customerRatingPrivacy } from "@autodeck/core";
import { ServiceScope } from "../../../ui/ServiceScope";
import { formatDurationWithDays } from "../../../lib/duration";
import { usePricingVehicle } from "../../../lib/vehicle-size";
import { useState, useEffect } from "react";
import { Pressable, View } from "react-native";
import type { ReactNode } from "react";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { customerCatalogueEligible, isSizePriced, needsInspectionNote, PAINT_INSPECTION_NOTE, resolvePricingCategory, type Service, type VehicleCategory, type PriceBreakdown as PriceBreakdownData } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
import { space} from "@autodeck/ui/theme";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { Button, Chip, Kicker, Loading, Notice, Pane, Row, Screen, T } from "../../../ui/kit";
import { db } from "../../../lib/firebase";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { useAuth } from "../../../hooks/useAuth";
import { sheetBarVisible } from "../../../lib/sticky-price";
import { ServicePrice } from "../../../ui/ServicePrice";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { COPY_IS_DRAFT, SHOW_BEFORE_AFTER, showcaseFor } from "../../../lib/showcase";
import { getServiceReviews, type ServiceReviews } from "../../../lib/review-service";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { getAvailability, todayIST } from "../../../lib/booking-service";
import { applyBrandWarranty, getServiceCatalogue, priceLabel } from "../../../lib/catalogue-service";


export default function ServiceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router=useRouter();
  const [sourceHold, setSourceHold] = useState(false);
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [catalogueTry, setCatalogueTry] = useState(0);
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
    let alive=true;setService(null);setLoading(true);setLoadError(false);setSourceHold(false);setReviews(null);setPriceBreakdown(null);
    if (!id || !customerOfferingVisible({id})) {setLoading(false);return;}
    if (!customerCatalogueEligible({id},__DEV__ && /identityPreview=1/.test((globalThis as {location?:{search?:string}}).location?.search ?? ""))) {setSourceHold(true);setLoading(false);return;}
    void (async () => {
      try {
        const list=await getServiceCatalogue();const current=list.find(s=>s.id===id && s.active === true && customerOfferingVisible(s));
        if(alive)setService(current?applyBrandWarranty(customerRatingPrivacy(current)):null);
      } catch { if(alive)setLoadError(true); }
      finally {if(alive)setLoading(false);}
    })();
    return()=>{alive=false};
  }, [id, catalogueTry]);

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
    let alive=true;void getServiceReviews(service.id).then(r=>{if(alive)setReviews(r)}).catch(()=>{if(alive)setReviews(null)});return()=>{alive=false};
  }, [service]);

  if(sourceHold) return <Screen appBar="Service enquiry"><T role="title">Ask the studio</T><T>Confirm the product and options for your car before booking.</T><Button label="Ask for a quote" onPress={()=>router.navigate("/(tabs)/help")} /></Screen>;
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
      onRetry={() => { if(loadError) setCatalogueTry((n) => n + 1); else setPriceTry((n) => n + 1); }}
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
  // Separate labelled booking action follows the price; duration stays informational.
  const [focused, setFocused] = useState(true);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  const { colors } = useExperienceTheme();
  const [after, setAfter] = useState(true);
  const [benefitsOpen,setBenefitsOpen]=useState(false);
  useEffect(()=>setBenefitsOpen(false),[id]);
  // Book now is offered only when there is a confirmed price to book against, or the service is a quote. With no car, no car type or no price the
  // price block above carries the one action (Garage / Try again), so there is no second, enabled-looking Book button.
  const showBar = !!service && sheetBarVisible({ priceOnRequest: service.priceOnRequest === true, loading: priceLoading, hasTotal: priceBreakdown !== null, needsCarType, error: priceError !== null });
  if (loading) return <Loading label="Opening the menu" />;
  if (loadError) return <Screen><Notice title="Can't load this service" body="Check your connection and try again." action={<Button icon="refresh" label="Try again" onPress={onRetry}/>} /></Screen>;
  if (!service) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." action={<Button kind="quiet" label="Browse services" onPress={()=>router.navigate("/(tabs)/catalogue")}/>} /></Screen>;

  const sc = showcaseFor(service);
  const H = (t: string, extra?: ReactNode) => (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Kicker>{t}</Kicker>
      {extra}
    </View>
  );
  const mins = service.estimatedDurationMinutes;
  const dur = formatDurationWithDays(mins);

  return (
    <View style={{ flex: 1 }}>
      <Screen
        header={
          <View style={{ gap: space.hair }}>
            <ServicePageHeader context={[SERVICE_HOMES.find(h=>h.key===servicePlacement(service)?.home)?.label,servicePlacement(service)?.family].filter(Boolean).join(" · ") || "Service"} title={service.name} crumbs={[{title:"All services",onPress:()=>router.navigate("/(tabs)/catalogue")}]} />
            {service.brand === "Add-ons" ? <T role="caption" tone="secondary">Optional extra, added along with a main service</T> : null}
          </View>
        }
      >
        <Pane pad="none">
          <ServicePhoto service={service} aspect={16 / 9} radius={26} />
        </Pane>

        <>
        <ServiceScope placement="description" showContactAndTip={false} service={service} onAsk={()=>router.push({pathname:"/(tabs)/help",params:{service:service.name}})}/>

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
          <T role="caption" tone="tertiary">Illustrative photo, not studio work.</T>
        </View> : null}

        <Kicker>{service.category==='garage'?'Price':'Price for your car'}</Kicker>
        <T role="caption" tone="secondary">{[`Estimated service time: ${dur}`,service.brand&&service.brand!=="Add-ons"?`Product brand: ${service.brand}`:null,service.warrantyLabel?`Listed warranty: ${service.warrantyLabel}`:null].filter(Boolean).join(" · ")}. The studio confirms timing before work starts.</T>
        <ServicePrice inlineBreakdown {...{category:service.category,priceOnRequest:service.priceOnRequest===true,needsCarType,hasCar:!!pricingVehicle.vehicle,carSizeKnown:!!selectedCategory,loading:priceLoading,error:priceError,breakdown:priceBreakdown,onRetry,onHelp:()=>router.navigate("/(tabs)/help"),onGarage:()=>router.push(pricingVehicle.vehicle?`/(tabs)/garage/${pricingVehicle.vehicle.id}`:"/(tabs)/garage/add")}}/>

        {focused&&showBar?<Button label={service.priceOnRequest===true?(service.category==="garage"||service.category==="modifications"?"Inspection":"Get quote"):"Book now"} disabled={!service.priceOnRequest&&priceBreakdown===null} onPress={()=>service.priceOnRequest===true&&SERVICE_QUOTE_JOURNEY_READY?router.push({pathname:"/(tabs)/quote-request",params:{serviceId:String(id)}}):router.push(`/(tabs)/book/${id}`)}/>:null}

        </>

        <>

        <ServiceScope placement="details" showContactAndTip={false} service={service} careTip={(service.careTips ?? [])[0] ?? null} onAsk={() => router.push({ pathname: "/(tabs)/help", params: { service: service.name } })} />

        {sc.benefits.length > 0 ? (
          <View style={{ gap: space.breath }}>
            <Pane pad="gap">
              <Row title="Why choose this service" detail={benefitsOpen?"Hide benefits":"See service benefits"} onPress={()=>setBenefitsOpen(!benefitsOpen)} last={!benefitsOpen}/>
              {benefitsOpen?sc.benefits.map((x, i) => (
                <Row key={x} title={<View style={{ flexDirection: "row", gap: space.line }}><View style={{ flex: 1 }}><T>{x}</T></View></View>} last={i === sc.benefits.length - 1} />
              )):null}
            </Pane>
          </View>
        ) : null}



        </>

        {COPY_IS_DRAFT ? <T role="caption" tone="tertiary">Draft text, pending studio review.</T> : null}
      </Screen>

    </View>
  );
}
