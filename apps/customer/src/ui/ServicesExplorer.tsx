import { Image, View, Pressable, useWindowDimensions, type ImageSourcePropType } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import {
  SERVICE_HOMES,
  PPF_CUSTOMER_OPTIONS,
  ppfWorkServices,
  type Service,
} from "@autodeck/core";
import { SceneCard } from "./SceneCard";
import { ServicePackageCard } from "./ServicePackageCard";
import { ServicePhoto } from "./ServicePhoto";
import {ServicePageHeader}from"./ServicePageHeader";
import { Button, Pane, Row, T } from "./kit";
import { serviceTypeImage } from "../lib/service-type-images";
import { useState } from "react";
import { serviceHomeImages } from "../lib/service-home-images";
import { BRAND_LOGOS } from "../lib/brand-logos";
import {
  currentServices,
  referenceChoices,
  servicePlacement,
  referencePlacement,
  familyChoices,
  HOME_COPY,
  FAMILY_COPY,
  familySummary,
  serviceSearch,
  workFirstFamily,
  type ServicesPath,
} from "../lib/services-navigation";
import type { BrandEnquiry } from "../lib/brand-enquiries";
import { parentPath } from "../lib/services-navigation";

export function ServiceChoiceCard({
  title,
  detail,
  onPress,
  brand,
  photo,
}: {
  title: string;
  detail: string;
  onPress: () => void;
  brand?: boolean;
  photo?: ImageSourcePropType;
}) {
  const { colors } = useExperienceTheme();
  const {width,fontScale}=useWindowDimensions();
  const compact=width<360||fontScale>1.15;
  const logo = brand ? BRAND_LOGOS[title] : null;
  return (
    <SceneCard
      label={title}
      onPress={onPress}
      style={{
        width: "100%",
        minWidth: 0,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: "hidden",
      }}
    >
      <View
        style={{
          padding: compact?14:18,
          gap: compact?10:14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {photo ? <TypePhoto source={photo} label={title} size={compact?64:88} /> : null}
        {logo ? (
          <View
            style={{
              width: 76,
              height: 76,
              padding: 10,
              borderRadius: 16,
              backgroundColor: logo.background,
            }}
          >
            <Image
              accessibilityLabel={`${title} logo`}
              source={logo.src}
              resizeMode="contain"
              style={{ width: "100%", height: "100%" }}
            />
          </View>
        ) : null}
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
          <T role="heading" style={{ fontSize: 20, lineHeight: 25 }}>
            {title}
          </T>
          <T role="caption" tone="secondary">
            {detail}
          </T>
        </View>
        <T tone="accent">›</T>
      </View>
    </SceneCard>
  );
}
export function ReferencePackageCard({
  item,
  onPress,
}: {
  item: BrandEnquiry;
  onPress: () => void;
}) {
  const { colors } = useExperienceTheme();
  return (
    <SceneCard
      label={`View ${item.name}`}
      onPress={onPress}
      style={{
        width: "100%",
        minWidth: 0,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: colors.borderSubtle,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 16, gap: 14, flexDirection: "row" }}>
        <View
          style={{
            width: 88,
            height: 108,
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <ServicePhoto
            service={{
              id: "enquiry:" + item.key,
              name: item.name,
              brand: item.brand,
              category: item.group === "ppf" ? "ppf" : "ceramic",
            }}
            width={88}
            height={108}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 6 }}>

          <T role="bodyStrong">{item.name}</T>
          <T role="caption" tone="secondary" numberOfLines={3}>
            {item.note}
          </T>
          <T role="bodyStrong" tone="accent">
            Quote to confirm
          </T>
          <T role="caption">{item.level === "brand" ? "View details" : item.brand ? "View range" : "View details"}</T>
        </View>
      </View>
    </SceneCard>
  );
}
/** Work-first product journey: the work is the page; the named product sits inside it
 *  as compact facts with one clear action. Only catalogue-record facts are shown. */
function WorkFirstProduct({
  service,
  onQuote,
  onOpen,
}: {
  service: Service;
  onQuote?: ((s: Service) => void) | undefined;
  onOpen: (s: Service) => void;
}) {
  const whereUsed = /^\s*[-•]?\s*Where used:\s*(.+)$/im.exec(service.description ?? "")?.[1]?.trim();
  return (
    <View style={{ gap: 20 }}>
      <Pane pad="none">
        <ServicePhoto service={service} aspect={16 / 9} radius={26} />
      </Pane>
      <Pane pad="gap">
        <Row title="Product" detail={service.name} last={!whereUsed} />
        {whereUsed ? <Row title="Where used" detail={whereUsed} last /> : null}
      </Pane>
      {service.priceOnRequest === true ? (
        <Button kind="quiet" label="Get quote" onPress={() => (onQuote ?? onOpen)(service)} />
      ) : (
        <Button kind="primary" label="View service" onPress={() => onOpen(service)} />
      )}
    </View>
  );
}
export function ServicesExplorer({
  services,
  path,
  query,
  onPath,
  onOpen,
  onQuote,
  onReference,
  onHelp,
  priceLabel,
}: {
  services: Service[];
  path: ServicesPath;
  query: string;
  onPath: (p: ServicesPath) => void;
  onOpen: (s: Service) => void;
  onQuote?: ((s: Service) => void) | undefined;
  onReference: (r: BrandEnquiry) => void;
  onHelp: (scope: string) => void;
  priceLabel: (s: Service) => string | null | undefined;
}) {
  const { colors } = useExperienceTheme();
  // Pickup/drop is a booking option, never a standalone sale card. This is presentation only.
  const rows = currentServices(services).filter(s=>s.category!=="pickup"),
    refs = referenceChoices(rows);
  const home = SERVICE_HOMES.find((h) => h.key === path.home);
  const searching = !!query.trim();
  const products = (xs: Service[], rs: BrandEnquiry[]) => (
    <View style={{ gap: 12 }}>
      {xs.map((s) => (
        <ServicePackageCard
          key={s.id}
          service={s}
          price={priceLabel(s)}
          onPress={() => onOpen(s)}
        />
      ))}
      {rs.map((r) => (
        <ReferencePackageCard
          key={r.key}
          item={r}
          onPress={() => onReference(r)}
        />
      ))}
    </View>
  );
  if (searching) {
    const found = rows.filter((s) => serviceSearch(s, query));
    const rr = refs.filter((r) =>
      `${r.brand ?? ""} ${r.name} ${referencePlacement(r).family}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    );
    return (
      <View style={{ gap: 20 }}>
        <ServicePageHeader title={`Results for "${query.trim()}"`} crumbs={[{title:"All services",onPress:()=>onPath({})}]}/>
        {found.length + rr.length ? (
          products(found, rr)
        ) : (
          <Pane>
            <T>No current services match this search.</T>
            <Button
              kind="quiet"
              label="Ask the studio"
              onPress={() => onHelp(query.trim())}
            />
          </Pane>
        )}
        <T role="caption" tone="tertiary">Service visuals are illustrative, not product or completed-job photos.</T>
      </View>
    );
  }
  if (!home)
    return (
      <View style={{ gap: 16 }}>
        <ServicePageHeader context="AutoDeck care" title="Explore services"/>
        {SERVICE_HOMES.map((h) => (
          <SceneCard
            key={h.key}
            label={h.label}
            onPress={() => onPath({ home: h.key })}
            style={{
              width: "100%",
              minWidth: 0,
              borderRadius: 24,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: colors.borderSubtle,
            }}
          >
            <View
              style={{ width: "100%", aspectRatio: 1.85, overflow: "hidden" }}
            >
              <Image
                source={serviceHomeImages[h.key]}
                resizeMode="cover"
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
            </View>
            <View style={{ padding: 18, gap: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <T role="heading" style={{ flex: 1, fontSize: 20, lineHeight: 25 }}>{h.label}</T>
                <T role="caption" style={{ fontSize: 22, lineHeight: 24 }}>›</T>
              </View>
              <T role="caption" tone="secondary">
                {HOME_COPY[h.key]}
              </T>
            </View>
          </SceneCard>
        ))}
        <T role="caption" tone="tertiary">
          Service images are illustrative. Only confirmed current offerings are
          shown as products.
        </T>
      </View>
    );
  const mine = rows.filter((s) => servicePlacement(s)?.home === home.key),
    rr = refs.filter((r) => referencePlacement(r).home === home.key);
  const families = familyChoices(home.key, mine, rr);
  const family =
    path.family && families.includes(path.family) ? path.family : null;
  // Brand is meaningful only inside a family (brand-less concepts like PPS
  // stay outside brand context); ignore a brand that arrives without one.
  const activeBrand = family ? (path.brand ?? null) : null;
  let selected = family
    ? mine.filter((s) => servicePlacement(s)?.family === family)
    : [];
  // Film ranges belong to full-body fitting only. Removal and replacement
  // are their own work and fall through to the confirm-with-studio pane.
  const selectedRefs = family
    ? rr.filter(
        (r) =>
          referencePlacement(r).family === family &&
          (family !== "PPF" || !path.work || path.work === "full_body"),
      )
    : [];
  if (family === "PPF")
    selected = path.work
      ? ppfWorkServices(
          selected,
          path.work as (typeof PPF_CUSTOMER_OPTIONS)[number]["key"],
        )
      : [];
  // "Add-ons" is a service type (optional extras added along with a main service),
  // not a brand: keep them out of the brand list and show them in their own section.
  const ADDON_BRAND = "Add-ons";
  const addonServices = selected.filter((s) => s.brand === ADDON_BRAND);
  const addonRefs = selectedRefs.filter((r) => r.brand === ADDON_BRAND);
  const brands = [
    ...new Set([
      ...selected.map((s) => s.brand).filter((b): b is string => !!b && b !== ADDON_BRAND),
      ...selectedRefs.map((r) => r.brand).filter((b): b is string => !!b && b !== ADDON_BRAND),
    ]),
  ].sort();
  const chooseBrands = !!family && brands.length > 0 && !activeBrand;
  const shown = activeBrand
    ? selected.filter((s) => s.brand === activeBrand)
    : selected;
  const shownRefs = activeBrand
    ? selectedRefs.filter((r) => r.brand === activeBrand)
    : selectedRefs;
  const workLabel = PPF_CUSTOMER_OPTIONS.find(
    (w) => w.key === path.work,
  )?.label;
  // Work-first families (owner-approved model): the family page is the work itself.
  // Named products and fixed-price studio applications keep their own records and
  // quote/booking targets; only the presentation merges them into one work page.
  const workFirst = workFirstFamily(home.key, family);
  if (workFirst && !activeBrand) {
    const named = selected.filter((s) => s.brand && s.brand !== ADDON_BRAND);
    const studio = selected.filter((s) => !s.brand || s.brand === ADDON_BRAND);
    return (
      <View style={{ gap: 20 }}>
        <ServicePageHeader
          title={workFirst.work}
          detail={FAMILY_COPY[family ?? ""]}
          context={`${home.label} · ${family}`}
          crumbs={[
            { title: "All services", onPress: () => onPath({}) },
            { title: home.label, onPress: () => onPath({ home: home.key }) },
          ]}
        />
        {named.length === 1 ? (
          <WorkFirstProduct service={named[0]!} onQuote={onQuote} onOpen={onOpen} />
        ) : named.length > 1 ? (
          products(named, [])
        ) : null}
        {studio.length > 0 ? (
          <>
            <T role="caption" tone="secondary">
              Also available at a fixed price
            </T>
            {products(studio, [])}
          </>
        ) : null}
        {selectedRefs.length > 0 ? products([], selectedRefs) : null}
        <T role="caption" tone="tertiary">
          Service visuals are illustrative, not product or completed-job photos.
        </T>
      </View>
    );
  }
  // The confirm pane reads as a sentence, so work names map to noun phrases.
  const askLabel =
    path.work === "removal"
      ? "film removal"
      : path.work === "replacement"
        ? "film replacement"
        : path.work === "full_body"
          ? "full-body protection"
          : (workLabel ?? family);
  return (
    <View style={{ gap: 20 }}>
      <ServicePageHeader title={activeBrand ?? workLabel ?? family ?? home.label} detail={!family?HOME_COPY[home.key]:family==="PPF"&&!path.work?FAMILY_COPY.PPF:FAMILY_COPY[family]} context={!family?"AutoDeck care":activeBrand&&(family??home.label).toLowerCase()!==activeBrand.toLowerCase()?(family??home.label):undefined} crumbs={!family?[]:[
        {title:"All services",onPress:()=>onPath({})},
        {title:home.label,onPress:()=>onPath({home:home.key})},
        ...(family?[{title:family,onPress:()=>onPath({home:home.key,family})}]:[]),
        ...(workLabel?[{title:workLabel,onPress:()=>onPath({home:home.key,family:family??undefined,work:path.work})}]:[]),
      ]}/>
      {!family ? (
        <>
          {families.map((f) => {
            return (
              <ServiceChoiceCard
                key={f}
                title={f}
                photo={serviceTypeImage(home.key, f)}
                detail={familySummary(f)}
                onPress={() => onPath({ home: home.key, family: f })}
              />
            );
          })}
        </>
      ) : family === "PPF" && !path.work ? (
        <>
          {PPF_CUSTOMER_OPTIONS.map((w) => (
            <ServiceChoiceCard
              key={w.key}
              title={w.label}
              photo={serviceTypeImage(home.key, "PPF")}
              detail="Confirm the film, covered areas and quote"
              onPress={() => onPath({ home: home.key, family, work: w.key })}
            />
          ))}
          <T role="caption" tone="secondary">
            Partial, front-only and custom coverage are handled offline.
          </T>
        </>
      ) : (
        <>
          {chooseBrands ? (
            <>
              <T role="caption" tone="secondary">
                Choose a brand to see its current offerings.
              </T>
              {brands.map((b) => (
                <ServiceChoiceCard
                  key={b}
                  title={b}
                  brand
                  detail={familySummary(family!)}
                  onPress={() => onPath({ ...path, brand: b })}
                />
              ))}
              {products(
                selected.filter((s) => !s.brand),
                selectedRefs.filter((r) => !r.brand),
              )}
              {addonServices.length + addonRefs.length > 0 ? (
                <>
                  <T role="caption" tone="secondary">
                    Optional extras you can add along with a main service.
                  </T>
                  {products(addonServices, addonRefs)}
                </>
              ) : null}
            </>
          ) : shown.length + shownRefs.length ? (
            products(shown, shownRefs)
          ) : (
            <Pane pad="gap">
              <T role="bodyStrong">
                Ask the studio about {askLabel}
              </T>
              <T tone="secondary">
                The studio confirms the work, time and quote for your car
                before you book.
              </T>
              <Button
                kind="quiet"
                label="Ask the studio"
                onPress={() =>
                  onHelp(
                    [home.label, family, workLabel, activeBrand]
                      .filter(Boolean)
                      .join(" · "),
                  )
                }
              />
            </Pane>
          )}
        </>
      )}
      {activeBrand ? (
        <Button
          kind="quiet"
          label="Change brand"
          onPress={() => onPath(parentPath(path))}
        />
      ) : null}
      <T role="caption" tone="tertiary">Service visuals are illustrative, not product or completed-job photos.</T>
    </View>
  );
}

function TypePhoto({
  source,
  label,
  size=88,
}: {
  source: ImageSourcePropType;
  label: string;
  size?: number;
}) {
  const { colors } = useExperienceTheme();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {failed ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Retry ${label} illustration`}
          onPress={() => {
            setFailed(false);
            setRetry((n) => n + 1);
          }}
        >
          <T role="caption">Retry image</T>
        </Pressable>
      ) : (
        <Image
          key={retry}
          source={source}
          accessibilityLabel={`${label} service illustration`}
          resizeMode="cover"
          onError={() => setFailed(true)}
          style={{ position: "absolute", width: "100%", height: "100%" }}
        />
      )}
    </View>
  );
}
