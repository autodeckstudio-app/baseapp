import{ServiceJourney}from'../../../ui/ServiceJourney';
import {ServicePageHeader,ServiceHeaderHidden} from '../../../ui/ServicePageHeader';
import ServiceDetailScreen from './[id]';
import{ServiceDetailPopup}from'../../../ui/ServiceDetailPopup';
import{useCataloguePublication}from'../../../hooks/useCataloguePublication';
import {useAuth} from '../../../hooks/useAuth';
import {useForegroundRefresh} from '../../../hooks/useForegroundRefresh';
import {homeCatalogueBack,catalogueReturnParams} from "../../../lib/home-service-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, Pressable, TextInput, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { SERVICE_HOMES, GST_ENABLED, type Service } from "@autodeck/core";
import { Button, Notice, Screen, Skeleton, T } from "../../../ui/kit";
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
import { SERVICE_QUOTE_JOURNEY_READY } from "../../../lib/service-quote";
import { useSegmentSwipe } from "../../../lib/segment-swipe";
import { glassInner } from "../../../lib/glass";

export default function CatalogueScreen() {
  const[reviewing,setReviewing]=useState(false);
  const router = useRouter(),
    params = useLocalSearchParams<{home?:string;family?:string;brand?:string;work?:string;cat?:string;need?:string;p?:string;mock?:string;theme?:string;returnTo?:string;homeEntry?:string}>();
  const { colors } = useExperienceTheme();
  const auth=useAuth();
  const ownerScope=auth.status==='ready'?`${auth.user.uid}:${auth.claims.tenantId}`:__DEV__&&params.mock==='1'?'preview':null;
  const ownerRef=useRef(ownerScope);ownerRef.current=ownerScope;
  const loadedScope=useRef(ownerScope);
  const [services, setServices] = useState<Service[] | null>(() =>
      peekCatalogue(),
    ),
    [error, setError] = useState(false),
    [q, setQ] = useState("");
  const { height: winH } = useWindowDimensions();
  const loadGeneration=useRef(0);
  const load = useCallback(async () => {
    const scope=ownerRef.current;if(!scope)return;
    const generation=++loadGeneration.current;
    setError(false);
    try {
      const rows=await getServiceCatalogue(undefined,{fresh:true});
      if(generation===loadGeneration.current&&scope===ownerRef.current){loadedScope.current=scope;setServices(rows);}
    } catch {
      if(generation===loadGeneration.current&&scope===ownerRef.current)setError(true);
    }
  }, []);
  useCataloguePublication(()=>{void load()});
  useForegroundRefresh(()=>{void load()},ownerScope);
  useEffect(()=>()=>{loadGeneration.current++},[]);
  const all = useMemo(() => currentServices(loadedScope.current===ownerScope?services ?? []:[]), [services,ownerScope]);
  const path = routePath(params, all);
  const pricingVehicle = usePricingVehicle(),
    prices = useVehiclePrices(all, pricingVehicle.category);
  const selfPath = usePathname();
  const [detailId,setDetailId]=useState<string|null>(null);
  useEffect(()=>setDetailId(null),[selfPath,ownerScope]);
  const navigate = (next: ServicesPath, replace = false) => {
    setQ("");
    // Stay on the current pathname so dev previews (e.g. /preview-catalogue) keep working,
    // and keep dev-only params (mock/theme) across in-screen navigation.
    const href = {
      pathname: selfPath as "/(tabs)/catalogue",
      params: { ...(params.returnTo==="home"?{returnTo:"home",homeEntry:params.homeEntry??""}:{}), ...pathParams(next), ...(params.mock ? { mock: params.mock } : {}), ...(params.theme ? { theme: params.theme } : {}) },
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
  const currentHome=SERVICE_HOMES.find(h=>h.key===path.home);
  const top = (
    <View
      style={{ gap: 14, paddingBottom: 16 }}
      testID="services-filter-header"
    >
      <><View
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
      </>
    </View>
  );
  return (
    <View style={{flex:1}}><Screen textBack
      scrollIdentity={JSON.stringify(path)}
      appBar="Services"
      top={top}
      onBack={params.returnTo==="home" ? () => {const parent=homeCatalogueBack(path,params.homeEntry);if(parent)navigate(parent,true);else router.navigate("/(tabs)");} : fromRoute ? () => router.canGoBack() ? router.back() : navigate(parentPath(path), true) : undefined}
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
          <ServiceJourney selectionEnabled={false} services={services} path={path} query={q} onPath={next=>{setReviewing(false);navigate(next)}} onOpen={s=>setDetailId(s.id)} onHelp={text=>router.push({pathname:"/(tabs)/help",params:{service:text}})} priceLabel={s=>servicePriceText(s,pricingVehicle.category,prices)} reviewing={reviewing} onReview={setReviewing} onBookSelection={ids=>{if(ids.length)router.push({pathname:"/(tabs)/book/[serviceId]",params:{serviceId:ids[0]}})}}/>
        ) : null}
      </View>
    <ServiceDetailPopup visible={detailId!==null} onClose={()=>setDetailId(null)}>{detailId?<ServiceDetailScreen key={detailId} serviceId={detailId} embedded/>:null}</ServiceDetailPopup>
    </Screen></View>
  );
}
