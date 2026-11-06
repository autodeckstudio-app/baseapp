import { Image, View, Pressable, type ImageSourcePropType } from "react-native";
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
import { SceneIntro } from "./SceneIntro";
import { Button, Pane, T } from "./kit";
import { serviceTypeImage } from "../lib/service-type-images";
import { useState } from "react";
import { serviceHomeImages } from "../lib/service-home-images";
import { BRAND_LOGOS } from "../lib/imagery";
import {
  currentServices,
  referenceChoices,
  servicePlacement,
  referencePlacement,
  familyChoices,
  HOME_COPY,
  FAMILY_COPY,
  serviceSearch,
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
          padding: 18,
          gap: 14,
          flexDirection: "row",
          alignItems: "center",
        }}
      >
        {photo ? <TypePhoto source={photo} label={title} /> : null}
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
          <T role="caption" tone="secondary">
            {item.brand}
          </T>
          <T role="bodyStrong">{item.name}</T>
          <T role="caption" tone="secondary" numberOfLines={2}>
            {item.note}
          </T>
          <T role="bodyStrong" tone="accent">
            Quote to confirm
          </T>
          <T role="caption">View range</T>
        </View>
      </View>
    </SceneCard>
  );
}
export function ServicesExplorer({
  services,
  path,
  query,
  onPath,
  onOpen,
  onReference,
  onHelp,
  priceLabel,
}: {
  services: Service[];
  path: ServicesPath;
  query: string;
  onPath: (p: ServicesPath) => void;
  onOpen: (s: Service) => void;
  onReference: (r: BrandEnquiry) => void;
  onHelp: (scope: string) => void;
  priceLabel: (s: Service) => string | null | undefined;
}) {
  const { colors } = useExperienceTheme();
  const rows = currentServices(services),
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
      <View style={{ gap: 18 }}>
        <SceneIntro
          compact
          eyebrow="All Services"
          title={`Results for “${query.trim()}”`}
        />
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
      </View>
    );
  }
  if (!home)
    return (
      <View style={{ gap: 16 }}>
        <SceneIntro
          compact
          eyebrow="AutoDeck care"
          title="Care for the car you love."
        />
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
              <T role="heading" style={{ fontSize: 24, lineHeight: 29 }}>
                {h.label}
              </T>
              <T role="caption" tone="secondary">
                {HOME_COPY[h.key]}
              </T>
              <T role="caption">Explore services ›</T>
            </View>
          </SceneCard>
        ))}
        {rows
          .filter((s) => s.category === "pickup")
          .map((s) => (
            <ServicePackageCard
              key={s.id}
              service={s}
              price={priceLabel(s)}
              onPress={() => onOpen(s)}
            />
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
  let selected = family
    ? mine.filter((s) => servicePlacement(s)?.family === family)
    : [];
  const selectedRefs = family
    ? rr.filter((r) => referencePlacement(r).family === family)
    : [];
  if (family === "PPF")
    selected = path.work
      ? ppfWorkServices(
          selected,
          path.work as (typeof PPF_CUSTOMER_OPTIONS)[number]["key"],
        )
      : [];
  const brands = [
    ...new Set([
      ...selected.map((s) => s.brand).filter((b): b is string => !!b),
      ...selectedRefs.map((r) => r.brand).filter((b): b is string => !!b),
    ]),
  ].sort();
  const chooseBrands = !!family && brands.length > 0 && !path.brand;
  const shown = path.brand
    ? selected.filter((s) => s.brand === path.brand)
    : selected;
  const shownRefs = path.brand
    ? selectedRefs.filter((r) => r.brand === path.brand)
    : selectedRefs;
  const workLabel = PPF_CUSTOMER_OPTIONS.find(
    (w) => w.key === path.work,
  )?.label;
  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {[
          { title: "All services", p: {} },
          { title: home.label, p: { home: home.key } },
          ...(family ? [{ title: family, p: { home: home.key, family } }] : []),
          ...(workLabel
            ? [
                {
                  title: workLabel,
                  p: {
                    home: home.key,
                    family: family ?? undefined,
                    work: path.work,
                  },
                },
              ]
            : []),
        ].map((c, i) => (
          <Pressable
            key={i}
            accessibilityRole="button"
            onPress={() => onPath(c.p)}
          >
            <T role="caption" tone="secondary">
              {i ? "› " : ""}
              {c.title}
            </T>
          </Pressable>
        ))}
      </View>
      <SceneIntro
        compact
        eyebrow={path.brand ? (family ?? home.label) : home.label}
        title={path.brand ?? workLabel ?? family ?? home.label}
      />
      {!family ? (
        <>
          <T tone="secondary">{HOME_COPY[home.key]}</T>
          <T role="caption" tone="tertiary">
            Service visuals are illustrative, not product or completed-job
            photos.
          </T>
          {families.map((f) => {
            const count =
              mine.filter((s) => servicePlacement(s)?.family === f).length +
              rr.filter((r) => referencePlacement(r).family === f).length;
            return (
              <ServiceChoiceCard
                key={f}
                title={f}
                photo={serviceTypeImage(home.key, f)}
                detail={
                  FAMILY_COPY[f] ??
                  (count
                    ? `${count} current ${count === 1 ? "option" : "options"}`
                    : "Confirm options with the studio")
                }
                onPress={() => onPath({ home: home.key, family: f })}
              />
            );
          })}
        </>
      ) : family === "PPF" && !path.work ? (
        <>
          <T tone="secondary">{FAMILY_COPY.PPF}</T>
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
          {FAMILY_COPY[family] ? (
            <T tone="secondary">{FAMILY_COPY[family]}</T>
          ) : null}
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
                  detail={`${selected.filter((s) => s.brand === b).length + selectedRefs.filter((r) => r.brand === b).length} current options`}
                  onPress={() => onPath({ ...path, brand: b })}
                />
              ))}
              {products(
                selected.filter((s) => !s.brand),
                selectedRefs.filter((r) => !r.brand),
              )}
            </>
          ) : shown.length + shownRefs.length ? (
            products(shown, shownRefs)
          ) : (
            <Pane pad="gap">
              <T role="bodyStrong">
                Confirm {workLabel ?? family} with the studio
              </T>
              <T tone="secondary">
                No confirmed current product or online package is listed for
                this choice. Ask the studio about availability, work, price and
                written terms before booking.
              </T>
              <Button
                kind="quiet"
                label="Ask about this service"
                onPress={() =>
                  onHelp(
                    [home.label, family, workLabel, path.brand]
                      .filter(Boolean)
                      .join(" · "),
                  )
                }
              />
            </Pane>
          )}
        </>
      )}
      {path.brand ? (
        <Button
          kind="quiet"
          label="Change brand"
          onPress={() => onPath(parentPath(path))}
        />
      ) : null}
    </View>
  );
}

function TypePhoto({
  source,
  label,
}: {
  source: ImageSourcePropType;
  label: string;
}) {
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  return (
    <View
      style={{
        width: 88,
        height: 88,
        borderRadius: 16,
        overflow: "hidden",
        backgroundColor: "#303338",
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
