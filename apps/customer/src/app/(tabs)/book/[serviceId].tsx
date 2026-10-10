import { ensureVehicleSize } from "../../../lib/saved-size";
import { DateField, SelectField } from "../../../ui/inputs";
import { VEHICLE_SIZES } from "../../../lib/vehicle-size";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles, updateVehicle } from "../../../lib/vehicle-service";
import { getAvailability, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
// V1 is explicitly single-studio-per-tenant (seeded once) - FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { useExperienceTheme } from "@autodeck/ui/native";
import { calculateServicePrice } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { Button, Chip, Kicker, Loading, Notice, Pane, Plate, Row, Screen, T, rupees } from "../../../ui/kit";

const VEHICLE_CATEGORIES: { value: VehicleCategory; label: string }[] = [
  { value: "hatchback", label: "Hatchback" },
  { value: "sedan", label: "Sedan" },
  { value: "suv", label: "SUV" },
  { value: "luxury", label: "Luxury / Premium" },
  { value: "van", label: "Van / MUV" },
  { value: "commercial", label: "Commercial" },
];

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
  const { colors } = useExperienceTheme();

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

  useEffect(()=>{setSelectedCategory(selectedVehicle?.category??null);setSizeError(null);},[selectedVehicle?.id,selectedVehicle?.category]);

  useEffect(() => {
    if (!serviceId || !service) return;
    setSlotsLoading(true);
    setSlotsError(false);
    void getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7)
      .then(setSlots)
      .catch(() => setSlotsError(true))
      .finally(() => setSlotsLoading(false));
  }, [serviceId, service,retryTick]);

  useEffect(()=>{setSelectedDate(cur=>slots.some(s=>s.date===cur)?cur:slots[0]?.date??null);},[slots]);

  async function handleSelectSlot(slot: AvailableSlot) {
    if (!selectedVehicle || !serviceId || !selectedCategory || sizeSaving) return;
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
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Book</Kicker><T role="title">{service.name}</T>{service.priceOnRequest === true ? <T role="caption" tone="accent">Quote on request</T> : total !== null ? <T role="caption" tone="accent">Total {rupees(total)} incl. tax</T> : null}</View>}>
      <View style={{ borderRadius: 28, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}><ServicePhoto service={service} aspect={16 / 9} radius={0} /><View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0) 50%, rgba(5,5,6,0.7) 100%)" } as object) }} /></View>
      <View style={{ gap: space.line }}>
        <Kicker>Your car</Kicker>
        {vehiclesError ? <Notice title="Can't load your cars" body="Try again before choosing a time." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>}/> : vehicles.length === 0 ? (
          <Notice title="Add your car first" body="We price and plan the work around it." action={<Button label="Add a car" onPress={() => router.push("/(tabs)/garage/add")} />} />
        ) : (
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
      </View>:selectedVehicle?.category?<T role="caption" tone="secondary">{VEHICLE_SIZES.find(x=>x.value===selectedVehicle.category)?.label} · Saved with your car</T>:null}

      <View style={{ gap: space.line }}>
        <Kicker>Pick a time</Kicker>
        <DateField label="Booking date" value={selectedDate??""} min={Object.keys(slotsByDate).sort()[0]} max={Object.keys(slotsByDate).sort().at(-1)} error={dateError??undefined} onChange={v=>{if(slotsByDate[v]){setSelectedDate(v);setDateError(null);}else setDateError("No available times on that date. Choose an available day.");}}/>
        {slotsError ? <Notice title="Can't load times" body="Check your connection and try again." action={<Button label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /> : null}
        {slotsLoading ? (
          <T role="caption" tone="tertiary">Checking the studio's calendar...</T>
        ) : !slotsError && Object.keys(slotsByDate).length === 0 ? (
          <Notice title="Fully booked this week" body="No free times in the next 7 days. Try again tomorrow or call the studio." />
        ) : (
          <View style={{gap:space.line}}><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:8}}>{Object.keys(slotsByDate).map(date=><Pressable key={date} accessibilityRole="button" accessibilityLabel={`Choose ${date}`} accessibilityState={{selected:date===selectedDate}} onPress={()=>setSelectedDate(date)} style={{minHeight:48,justifyContent:"center",paddingHorizontal:16,paddingVertical:10,borderRadius:14,borderWidth:1,borderColor:date===selectedDate?colors.accent:colors.borderSubtle,backgroundColor:date===selectedDate?colors.accentHaze:"transparent"}}><T role="caption" tone={date===selectedDate?"accent":"secondary"}>{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"})}</T></Pressable>)}</ScrollView>{Object.entries(slotsByDate).filter(([date])=>date===selectedDate).map(([date, daySlots]) => (
            <Pane key={date} pad="gap">
              <View style={{ gap: space.line }}>
                <T role="heading">{new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</T>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.breath }}>
                  {[...daySlots].sort((a,b)=>a.startAt.localeCompare(b.startAt)).map((slot) => {
                    const multiDay = slot.estimatedEndDate !== slot.date;
                    return (
                      <Pressable
                        key={slot.startAt}
                        accessibilityRole="button"
                        accessibilityLabel={`Book ${slot.startTime}`}
                        disabled={!selectedVehicle || !selectedCategory || vehiclesError || sizeSaving}
                        onPress={() => void handleSelectSlot(slot)}
                        style={({ pressed }) => ({ borderRadius: 9999, borderWidth: 1, borderColor: "rgba(245,154,69,0.55)", backgroundColor: "rgba(245,154,69,0.12)", paddingHorizontal: 16, paddingVertical: 10, opacity: !selectedVehicle ? 0.4 : pressed ? 0.7 : 1, minWidth: 76, minHeight:44, justifyContent:"center", alignItems: "center" })}
                      >
                        <T role="data" tone="accent">{slot.startTime}</T>
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
      </View>
    </Screen>
  );
}
