import { ensureVehicleSize } from "../../../lib/saved-size";
import { CarThumb } from "../../../ui/CarThumb";
import { SelectField } from "../../../ui/inputs";
import { VEHICLE_SIZES } from "../../../lib/vehicle-size";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles, updateVehicle } from "../../../lib/vehicle-service";
import { getAvailability, peekAvailability, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
// V1 is explicitly single-studio-per-tenant (seeded once) - FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { CAR_SEGMENTS, FIRST_STUDIO_ID, normalizeSegment, segmentLabel } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { calculateServicePrice, getServiceCatalogue } from "../../../lib/catalogue-service";
import { eligibleExtras, extrasToParam, toggleExtra } from "../../../lib/visit-extras";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { Button, Chip, Kicker, Loading, Notice, Pane, Plate, Row, Screen, Skeleton, T, rupees } from "../../../ui/kit";

const VEHICLE_CATEGORIES = CAR_SEGMENTS;

const durationText = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

export default function BookServiceScreen() {
  const { serviceId } = useLocalSearchParams<{ serviceId: string }>();
  const router = useRouter();
  const auth = useAuth();

  const [service, setService] = useState<Service | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<VehicleCategory|null>(null);
  const [dateError,setDateError]=useState<string|null>(null);
  const [sizeSaving,setSizeSaving]=useState(false);
  const [pickedSlot,setPickedSlot]=useState<AvailableSlot|null>(null);
  const [sizeError,setSizeError]=useState<string|null>(null);
  const [selectedDate,setSelectedDate] = useState<string|null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [vehiclesError,setVehiclesError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const { colors, name: themeName } = useExperienceTheme();

  // More services in the same visit: same bay type only, so one slot fits them all. The server checks again.
  const [catalogue, setCatalogue] = useState<Service[]>([]);
  const [extraIds, setExtraIds] = useState<string[]>([]);
  const [extraTotals, setExtraTotals] = useState<Record<string, number>>({});
  useEffect(() => { let alive = true; void getServiceCatalogue().then((c) => { if (alive) setCatalogue(c); }).catch(() => undefined); return () => { alive = false; }; }, []);
  useEffect(() => {
    if (!selectedCategory) return;
    let alive = true;
    for (const id of extraIds) void calculateServicePrice(id, selectedCategory).then(({ breakdown }) => { if (alive) setExtraTotals((t) => ({ ...t, [id]: breakdown.total })); }).catch(() => undefined);
    return () => { alive = false; };
  }, [extraIds.join(","), selectedCategory]);
  const extraKey = extraIds.join(",");
  const extraList = extraIds.map((id) => catalogue.find((c) => c.id === id)).filter((x): x is Service => Boolean(x));
  const extraMinutes = extraList.reduce((m, e) => m + e.estimatedDurationMinutes, 0);
  const extraPriced = extraIds.every((id) => extraTotals[id] !== undefined);
  const visitTotal = total !== null && extraPriced ? total + extraIds.reduce((t, id) => t + (extraTotals[id] ?? 0), 0) : null;

  useEffect(() => {
    setTotal(null);
    if (!serviceId || !selectedCategory) return;
    let current=true;
    void calculateServicePrice(serviceId, selectedCategory).then(({ breakdown }) => {if(current)setTotal(breakdown.total);}).catch(() => {if(current)setTotal(null);});
    return ()=>{current=false;};
  }, [serviceId, selectedCategory]);

  useEffect(() => {
    if (!serviceId || auth.status !== "ready") return;
    setLoading(true); setLoadError(false);
    void (async () => {
      try {
        const serviceSnap = await getDoc(doc(db, COLLECTIONS.services(), serviceId));
        if (serviceSnap.exists()) setService(serviceSnap.data() as Service);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId, auth.status, retryTick]);

  useEffect(() => {
    if (auth.status !== "ready") return;
    return listenToMyVehicles(
      auth.user.uid,
      auth.claims.tenantId,
      (list) => {
        setVehiclesError(false);
        setVehicles(list);
        void AsyncStorage.getItem("autodeck.activeVehicle").then(activeId=>setSelectedVehicle(cur=>{
          const keep=cur&&list.find(v=>v.id===cur.id);
          return keep??list.find(v=>v.id===activeId)??list[0]??null;
        }));
      },
      () => setVehiclesError(true),
    );
  }, [auth.status,retryTick]);

  useEffect(()=>{setSelectedCategory(normalizeSegment(selectedVehicle?.category));setSizeError(null);},[selectedVehicle?.id,selectedVehicle?.category]);

  useEffect(() => {
    if (!serviceId || !service) return;
    const ids = extraKey ? extraKey.split(",") : [];
    const warm = peekAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7, ids);
    if (warm) setSlots(warm);
    setSlotsLoading(!warm);
    setSlotsError(false);
    setPickedSlot(null);
    let alive = true;
    void getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7, ids)
      .then((r) => { if (alive) setSlots(r); })
      .catch(() => { if (alive) setSlotsError(true); })
      .finally(() => { if (alive) setSlotsLoading(false); });
    return () => { alive = false; };
  }, [serviceId, service, retryTick, extraKey]);

  useEffect(()=>{setSelectedDate(cur=>slots.some(s=>s.date===cur)?cur:slots[0]?.date??null);},[slots]);

  async function handleSelectSlot(slot: AvailableSlot) {
    if (!selectedVehicle || !serviceId || sizeSaving) return;
    if (!selectedCategory) { setSizeError("Choose your car size before continuing."); return; }
    const vehicleId=selectedVehicle.id;
    if(!selectedVehicle.category){
      setSizeSaving(true);setSizeError(null);
      try{await ensureVehicleSize(selectedVehicle,selectedCategory,updateVehicle);}
      catch(e){setSizeError(e instanceof Error?e.message:"Could not save the car size. Try again.");setSizeSaving(false);return;}
      setSizeSaving(false);
    }
    router.push({
      pathname: "/(tabs)/book/confirm",
      params: {
        serviceId,
        ...(extraIds.length ? { extras: extrasToParam(extraIds) } : {}),
        vehicleId: selectedVehicle.id,
        vehicleCategory: selectedCategory,
        scheduledDate: slot.date,
        scheduledTime: slot.startTime,
        startAt: slot.startAt,
        estimatedEndAt: slot.estimatedEndAt,
        estimatedEndDate: slot.estimatedEndDate,
        endTime: slot.endTime,
      },
    });
  }


  if (loading) return <Loading label="Finding times" />;
  if (loadError) return <Screen><Notice title="Can't open booking" body="Check your connection and try again." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
  if (!service || service.active === false) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." /></Screen>;

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    (acc[slot.date] ??= []).push(slot);
    return acc;
  }, {});

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Book</Kicker><T role="title">{service.name}</T>{service.priceOnRequest === true ? <T role="caption" tone="accent">Quote on request</T> : total !== null ? <T role="bodyStrong" tone="accent">{visitTotal !== null ? rupees(visitTotal) : extraIds.length ? "" : rupees(total)} · {durationText(service.estimatedDurationMinutes + extraMinutes)}</T> : null}</View>}>
      <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}><ServicePhoto service={service} aspect={3} radius={0} /><View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0) 50%, rgba(5,5,6,0.7) 100%)" } as object) }} /></View>
      <View style={{ gap: space.line }}>
        <Kicker>Booking for</Kicker>
        {selectedVehicle && vehicles.length <= 1 ? <Pane pad="inset"><View style={{flexDirection:"row",alignItems:"center",gap:14}}>{selectedVehicle.photoUrl?<CarThumb car={selectedVehicle} height={60} width={84} radius={12}/>:null}<View style={{flex:1,gap:6}}><T role="heading">{selectedVehicle.make} {selectedVehicle.model}</T><Plate value={selectedVehicle.registrationNumber}/></View></View></Pane> : null}
        {vehiclesError ? <Notice title="Can't load your cars" body="Try again before choosing a time." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>}/> : vehicles.length === 0 ? (
          <Notice title="Add your car first" body="We price and plan the work around it." action={<Button label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} />} />
        ) : vehicles.length === 1 ? null : (
          <Pane pad="gap">
            {vehicles.map((v, i) => {
              const selected = selectedVehicle?.id === v.id;
              return (
                <Row
                  key={v.id}
                  title={`${v.make} ${v.model}`}
                  detail={<Plate value={v.registrationNumber} />}
                  trailing={selected ? <Chip label="Selected" tone="accent" /> : null}
                  onPress={() => {
                    if(sizeSaving)return;
                    setSelectedVehicle(v);
                    setSelectedCategory(v.category??null);
                  }}
                  last={i === vehicles.length - 1}
                />
              );
            })}
          </Pane>
        )}
      </View>

      {selectedVehicle && !selectedVehicle.category ? <View style={{gap:space.line}}>
        <Kicker>Save your car size</Kicker>
        <T role="caption" tone="secondary">Choose once. We save it with this car for future bookings.</T>
        <SelectField label="Car size" value={selectedCategory??""} placeholder="Choose size" options={VEHICLE_SIZES} onChange={v=>setSelectedCategory(v as VehicleCategory)}/>
        {sizeError?<T role="caption" tone="danger">{sizeError}</T>:null}
        {sizeSaving?<T role="caption">Saving your car size...</T>:null}
      </View>:selectedVehicle?.category?<T role="caption" tone="secondary">{segmentLabel(selectedVehicle.category)} · Saved with your car</T>:null}

      {service.priceOnRequest !== true && eligibleExtras(service, catalogue).length > 0 ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Add to this visit</Kicker>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
            {eligibleExtras(service, catalogue).map((e) => {
              const on = extraIds.includes(e.id);
              return (
                <Pressable key={e.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setExtraIds((p) => toggleExtra(p, e.id))} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: on ? (colors.textPrimary) : "rgba(128,128,128,0.14)" }}>
                  <T role="bodyStrong" style={{ color: on ? (themeName === "light" ? "#F4F1EC" : "#16181C") : colors.textPrimary, fontSize: 13 }}>{on ? "\u2713 " : "+ "}{e.name}</T>
                </Pressable>
              );
            })}
          </ScrollView>
          {extraIds.length > 0 ? <T role="caption" tone="tertiary">One visit, one slot. Times below fit all {extraIds.length + 1} services.</T> : null}
        </View>
      ) : null}

      <View style={{ gap: space.line }}>
        <Kicker>Pick a time</Kicker>
        {slotsError ? <Notice title="Can't load times" body="Check your connection and try again." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /> : null}
        {slotsLoading ? (
          <View style={{ gap: space.line }}><View style={{ flexDirection: "row", gap: 8 }}><Skeleton height={40} width={110} /><Skeleton height={40} width={110} /></View><Skeleton height={150} /></View>
        ) : !slotsError && Object.keys(slotsByDate).length === 0 ? (
          <Notice title="Fully booked this week" body="No free times in the next 7 days. Try again tomorrow or call the studio." />
        ) : (
          <View style={{gap:space.line}}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{Object.keys(slotsByDate).map(date=><Pressable key={date} accessibilityRole="button" accessibilityLabel={`Choose ${date}`} accessibilityState={{selected:date===selectedDate}} onPress={()=>{setSelectedDate(date);setPickedSlot(null);}} style={{minHeight:48,justifyContent:"center",paddingHorizontal:16,paddingVertical:10,borderRadius:14,borderWidth:1,borderColor:date===selectedDate?colors.accent:colors.borderSubtle,backgroundColor:date===selectedDate?colors.accentHaze:"transparent"}}><T role="caption" tone={date===selectedDate?"accent":"secondary"}>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</T></Pressable>)}</ScrollView>{Object.entries(slotsByDate).filter(([date])=>date===selectedDate).map(([date, daySlots]) => (
            <Pane key={date} pad="gap">
              <View style={{ gap: space.line }}>
                <T role="heading">{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
                  {[...daySlots].sort((a,b)=>a.startAt.localeCompare(b.startAt)).map((slot) => {
                    const multiDay = slot.estimatedEndDate !== slot.date;
                    const past = Date.parse(slot.startAt) < Date.now();
                    const on = pickedSlot?.startAt === slot.startAt;
                    return (
                      <Pressable
                        key={slot.startAt}
                        accessibilityRole="button"
                        accessibilityLabel={`Time ${slot.startTime}${past ? ", already passed" : ""}`}
                        accessibilityState={{ selected: on, disabled: past }}
                        disabled={past}
                        onPress={() => { setPickedSlot(slot); setSizeError(null); }}
                        style={({ pressed }) => ({ borderRadius: 9999, borderWidth: 1, borderColor: on ? "#EC8638" : "rgba(128,128,128,0.28)", backgroundColor: on ? "rgba(236,134,56,0.14)" : "rgba(128,128,128,0.08)", paddingHorizontal: 16, paddingVertical: 10, opacity: past ? 0.3 : pressed ? 0.7 : 1, minWidth: 76, minHeight:44, justifyContent:"center", alignItems: "center" })}
                      >
                        <T role="data" tone={on ? "accent" : "primary"}>{slot.startTime}</T>
                        {multiDay ? (
                          <T role="caption" tone="tertiary">ready {new Date(`${slot.estimatedEndDate}T12:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</T>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </Pane>
          ))}</View>
        )}
        {sizeError ? <T role="caption" tone="danger">{sizeError}</T> : null}
        <Button label={pickedSlot ? `Continue with ${pickedSlot.startTime}` : "Pick a time to continue"} disabled={!pickedSlot || !selectedVehicle || vehiclesError || sizeSaving} busy={sizeSaving} onPress={() => { if (pickedSlot) void handleSelectSlot(pickedSlot); }} />
      </View>
    </Screen>
  );
}
