import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { SERVICE_HOMES, GST_ENABLED, type Service } from "@autodeck/core";
import { FilterPills } from "../../../ui/FilterPills";
import { Button, Notice, Screen, Skeleton, T } from "../../../ui/kit";
import { JourneySheet } from "../../../ui/JourneySheet";
import { ServicesExplorer } from "../../../ui/ServicesExplorer";
import {
  getServiceCatalogue,
  peekCatalogue,
} from "../../../lib/catalogue-service";
import {
  currentServices,
  parentPath,
  pathParams,
  routePath,
  type ServicesPath,
} from "../../../lib/services-navigation";
import {
  usePricingVehicle,
  useVehiclePrices,
  servicePriceText,
} from "../../../lib/vehicle-size";
import { careEntryPrice } from "../../../lib/service-journey";
import { useSegmentSwipe } from "../../../lib/segment-swipe";
import { glassInner } from "../../../lib/glass";

export default function CatalogueScreen() {
  const router = useRouter(),
    params = useLocalSearchParams<{home?:string;family?:string;brand?:string;work?:string;cat?:string;need?:string;p?:string}>();
  const { colors } = useExperienceTheme();
  const [services, setServices] = useState<Service[] | null>(() =>
      peekCatalogue(),
    ),
    [error, setError] = useState(false),
    [q, setQ] = useState("");
  const { height: winH } = useWindowDimensions();
  const load = useCallback(async () => {
    setError(false);
    try {
      setServices(await getServiceCatalogue());
    } catch {
      setError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const all = useMemo(() => currentServices(services ?? []), [services]);
  const path = routePath(params, all);
  const pricingVehicle = usePricingVehicle(),
    prices = useVehiclePrices(all, pricingVehicle.category);
  const navigate = (next: ServicesPath, replace = false) => {
    setQ("");
    const href = {
      pathname: "/(tabs)/catalogue" as const,
      params: pathParams(next),
    };
    if (replace) router.replace(href);
    else router.push(href);
  };
  const filterKeys = ["all", ...SERVICE_HOMES.map((h) => h.key)];
  const pathRef = useRef(path);
  pathRef.current = path;
  const searching = !!q.trim();
  const fromRoute = !!path.home;
  const swipe = useSegmentSwipe(
    filterKeys,
    () => pathRef.current.home ?? "all",
    (key) =>
      navigate(
        key === "all" ? {} : { home: key as ServicesPath["home"] },
        true,
      ),
  );
  const top = (
    <View
      style={{ gap: 14, paddingBottom: 16 }}
      testID="services-filter-header"
    >
      <View
        style={{
          height: 48,
          borderRadius: 24,
          ...glassInner,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          paddingHorizontal: 16,
        }}
      >
        <Icon name="search" color={colors.textTertiary} size={20} />
        <TextInput
          accessibilityLabel="Search services"
          value={q}
          onChangeText={setQ}
          placeholder="Search all services"
          placeholderTextColor={colors.textTertiary}
          style={
            {
              flex: 1,
              minWidth: 0,
              color: colors.textPrimary,
              fontSize: 15,
              outlineStyle: "none",
            } as never
          }
        />
        {q ? (
          <Button
            kind="quiet"
            label="Clear"
            onPress={() => setQ("")}
            style={{ marginTop: 0, paddingHorizontal: 8, minHeight: 32 }}
          />
        ) : null}
      </View>
      <FilterPills
        items={[
          { key: "all", label: "All" },
          ...SERVICE_HOMES.map((h) => ({ key: h.key, label: h.label })),
        ]}
        value={path.home ?? "all"}
        onChange={(key) =>
          navigate(
            key === "all" ? {} : { home: key as ServicesPath["home"] },
            true,
          )
        }
      />
      {pricingVehicle.label ? (
        <T role="caption" tone="secondary">
          For your {pricingVehicle.vehicle?.make}{" "}
          {pricingVehicle.vehicle?.model} · {pricingVehicle.label}{GST_ENABLED ? " · incl. GST" : ""}
        </T>
      ) : null}
    </View>
  );
  return (
    <Screen
      key={JSON.stringify(path)}
      appBar="Services"
      top={top}
      onBack={fromRoute ? () => navigate(parentPath(path), true) : undefined}
    >
      <View
        key={JSON.stringify(path)}
        testID="services-swipe-area"
        {...(!path.family && !searching ? swipe.handlers : {})}
        style={[
          { gap: 20, minHeight: Math.max(winH - 300, 480) },
          !path.family && !searching ? swipe.style : null,
        ]}
      >
        {error ? (
          <Notice
            title="Can't refresh services"
            body="Check your connection and try again. Any saved menu below may be out of date."
            action={
              <Button
                kind="quiet"
                label="Try again"
                onPress={() => void load()}
              />
            }
          />
        ) : null}
        {!services && !error ? (
          <>
            <Skeleton height={64} />
            <Skeleton height={180} />
          </>
        ) : null}
        {services ? (
          <ServicesExplorer
            services={services}
            path={path}
            query={q}
            onPath={navigate}
            onOpen={(s) => router.push(`/(tabs)/catalogue/${s.id}`)}
            onReference={(r) =>
              router.push({
                pathname: "/(tabs)/catalogue/enquiry",
                params: { id: r.key },
              })
            }
            onHelp={(service) =>
              router.push({ pathname: "/(tabs)/help", params: { service } })
            }
            priceLabel={(s) =>
              careEntryPrice(
                servicePriceText(s, pricingVehicle.category, prices),
                !!pricingVehicle.category,
              )
            }
          />
        ) : null}
        {services && !fromRoute && !searching ? (
          <JourneySheet kind="services" />
        ) : null}
      </View>
    </Screen>
  );
}
