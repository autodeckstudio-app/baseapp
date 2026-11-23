import ServiceExperience from '../../../ui/ServiceExperience';
import {useServiceSelection} from '../../../hooks/useServiceSelection';
import{ServiceJourney}from'../../../ui/ServiceJourney';
import{ServiceSelectionBar}from'../../../ui/ServiceSelectionBar';
import {ServicePageHeader,ServiceHeaderHidden} from '../../../ui/ServicePageHeader';
import ServiceDetailScreen from './[id]';
import{ServiceDetailPopup}from'../../../ui/ServiceDetailPopup';
import{useCataloguePublication}from'../../../hooks/useCataloguePublication';
import {useAuth} from '../../../hooks/useAuth';
import {useForegroundRefresh} from '../../../hooks/useForegroundRefresh';
import {homeCatalogueBack,catalogueReturnParams} from "../../../lib/home-service-navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, Pressable, TextInput, View, useWindowDimensions, Platform } from "react-native";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { SERVICE_HOMES, GST_ENABLED, type Service } from "@autodeck/core";
import { Button, Notice, PageHeader, Screen, Skeleton, T } from "../../../ui/kit";
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
import { glassInner } from "../../../lib/glass";

export default function CatalogueScreen() {
  const[innerBack,setInnerBack]=useState<(()=>void)|null>(null);const registerInnerBack=useCallback((back:(()=>void)|null)=>setInnerBack(()=>back),[]);
  const[innerView,setInnerView]=useState('list');const scrollCheckpoint=useRef<(()=>void)|null>(null);
  const[reviewing,setReviewing]=useState(false);const selection=useServiceSelection();const reviewSelection=(value:boolean)=>{if(value!==reviewing){scrollCheckpoint.current?.();setReviewing(value)}};
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
  const fromRoute=!!path.home;
  const sharedRootHeader=!path.home&&!reviewing;
  const currentHome=SERVICE_HOMES.find(h=>h.key===path.home);
  const top = (
    <View
      style={{ gap: 12, paddingBottom: 4 }}
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
  if(Platform.OS==='web')return <View style={{flex:1,minHeight:0}}>
    {!services&&!error?<Screen><Skeleton height={64}/><Skeleton height={180}/></Screen>:<ServiceExperience key={selection.scope??ownerScope??'signed-out'} services={all} path={path} selection={selection} pricingVehicle={pricingVehicle} priceLabel={s=>servicePriceText(s,pricingVehicle.category,prices)} refreshError={error} onRefresh={()=>void load()} onPath={next=>{setReviewing(false);navigate(next,next.home===path.home)}} onOpen={s=>setDetailId(s.id)} onHelp={text=>router.push({pathname:'/(tabs)/help',params:{service:text}})} onCoordinate={ids=>router.push({pathname:'/(tabs)/coordinate',params:{services:ids.join(',')}})} onBookSelection={ids=>{if(ids.length)router.push({pathname:'/(tabs)/book/[serviceId]',params:{serviceId:ids[0],...(ids.length>1?{extras:ids.slice(1).join(',')}:{})}})}} onChooseCar={()=>router.navigate('/(tabs)/garage')} onVisitRequests={()=>router.navigate('/(tabs)/coordinate')} onBack={params.returnTo==='home'?()=>{const parent=homeCatalogueBack(path,params.homeEntry);if(parent)navigate(parent,true);else router.navigate('/(tabs)')}:path.home?()=>router.canGoBack()?router.back():navigate(parentPath(path),true):undefined}/>}
    <ServiceDetailPopup visible={detailId!==null} onClose={()=>setDetailId(null)}>{detailId?<ServiceDetailScreen key={detailId} serviceId={detailId} embedded/>:null}</ServiceDetailPopup>
  </View>;
  return (
    <View style={{flex:1}}><Screen scrollCheckpointRef={scrollCheckpoint} textBack compactContent={!sharedRootHeader} viewportBottomInset={selection.ids.length&&!reviewing?152:88} bottomClearance={24}
      scrollIdentity={JSON.stringify([path,reviewing?'cart':innerView])}
      appBar="Services"
      top={sharedRootHeader?undefined:top}
      header={sharedRootHeader?<PageHeader title="Care for your car" sub="Choose a service area or search all services."/>:undefined}
      onBack={reviewing?()=>reviewSelection(false):innerBack??(params.returnTo==="home" ? () => {const parent=homeCatalogueBack(path,params.homeEntry);if(parent)navigate(parent,true);else router.navigate("/(tabs)");} : fromRoute ? () => router.canGoBack() ? router.back() : navigate(parentPath(path), true) : undefined)}
    >
      {sharedRootHeader?top:null}
      <View
                testID="services-swipe-area"
        style={[
          { gap: 20, minHeight: Math.max(winH - 300, 480) },
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
          <ServiceJourney onViewIdentity={setInnerView} onInnerBack={registerInnerBack} showRootHeader={!sharedRootHeader} services={services} path={path} query={q} onPath={next=>{setReviewing(false);navigate(next,next.home===path.home)}} onOpen={s=>setDetailId(s.id)} onHelp={text=>router.push({pathname:"/(tabs)/help",params:{service:text}})} priceLabel={s=>servicePriceText(s,pricingVehicle.category,prices)} reviewing={reviewing} onReview={reviewSelection} onCoordinate={ids=>router.push({pathname:'/(tabs)/coordinate',params:{services:ids.join(',')}})} onBookSelection={ids=>{if(ids.length)router.push({pathname:"/(tabs)/book/[serviceId]",params:{serviceId:ids[0],...(ids.length>1?{extras:ids.slice(1).join(",")}:{} )}})}}/>
        ) : null}
      </View>
    <ServiceDetailPopup visible={detailId!==null} onClose={()=>setDetailId(null)}>{detailId?<ServiceDetailScreen key={detailId} serviceId={detailId} embedded/>:null}</ServiceDetailPopup>
    </Screen>{!reviewing?<ServiceSelectionBar services={services??[]} onReview={()=>reviewSelection(true)}/>:null}</View>
  );
}
