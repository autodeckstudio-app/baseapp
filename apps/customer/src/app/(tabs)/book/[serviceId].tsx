import {ServiceTimePicker} from '../../../ui/ServiceTimePicker';
import { customerOfferingVisible } from '../../../lib/customer-offering-visibility';
import { CarThumb } from "../../../ui/CarThumb";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { collapseStaleBookEntries } from "../../../lib/back-nav";
import { doc, getDoc} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { pickDay, comboFor } from "../../../lib/booking-ideas";
import { formatDuration } from "../../../lib/duration";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles, updateVehicle } from "../../../lib/vehicle-service";
import { listOwnerKey } from "../../../lib/owner-key";
import { getAvailability, peekAvailability, todayIST, type AvailableSlot } from "../../../lib/booking-service";
import type { Service, Vehicle, VehicleCategory } from "@autodeck/core";
import { COLLECTIONS } from "@autodeck/database";
// V1 is explicitly single-studio-per-tenant (seeded once) - FIRST_STUDIO_ID
// is the correct, intentional value here, unlike tenantId which must always
// come from the authenticated user's own claims (see Phase 3G HANDOFF).
import { CAR_SEGMENTS, FIRST_STUDIO_ID, normalizeSegment, segmentLabel } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { calculateServicePrice, getServiceCatalogue } from "../../../lib/catalogue-service";
import { ServicePhoto } from "../../../ui/ServicePhoto";
import { Button, Chip, Kicker, Loading, Notice, Pane, Plate, Row, Screen, Skeleton, T, rupees } from "../../../ui/kit";

const VEHICLE_CATEGORIES = CAR_SEGMENTS;

const durationText = formatDuration;

export default function BookServiceScreen() {
  const { serviceId, day } = useLocalSearchParams<{ serviceId: string; day?: string }>();
  const [dayMissed, setDayMissed] = useState(false);
  const router = useRouter();
  const navigation = useNavigation();
  useEffect(() => { const reset = collapseStaleBookEntries(navigation.getState() as never); if (reset) navigation.dispatch({ type: "RESET", payload: reset } as never); }, []);
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

  // More services in the same visit: same bay type only, so one slot fits them all. The server checks again.
  const [catalogue, setCatalogue] = useState<Service[]>([]);
  // A combo is one fixed bundle: no options, no default selections, nothing added to price or time.
  const combo = comboFor(catalogue, serviceId);
  useEffect(() => { let alive = true; void getServiceCatalogue().then((c) => { if (alive) setCatalogue(c); }).catch(() => undefined); return () => { alive = false; }; }, []);

  useEffect(() => {
    setTotal(null);
    if (!serviceId || !selectedCategory || !customerOfferingVisible({id:serviceId}) || !service || !customerOfferingVisible(service)) return;
    let current=true;
    void calculateServicePrice(serviceId, selectedCategory).then(({ breakdown }) => {if(current)setTotal(breakdown.total);}).catch(() => {if(current)setTotal(null);});
    return ()=>{current=false;};
  }, [serviceId, selectedCategory, service]);

  const ownerKey=listOwnerKey(auth);const owner=auth.status==='ready'&&ownerKey?`${auth.claims.tenantId}:${auth.user.uid}:${ownerKey.key}`:null;
  useEffect(()=>{let alive=true;setService(null);setSlots([]);setPickedSlot(null);setLoadError(false);setLoading(true);if(!serviceId||!customerOfferingVisible({id:serviceId})||auth.status!=='ready'){setLoading(false);return;}
    void getServiceCatalogue().then(list=>{if(alive)setService(list.find(s=>s.id===serviceId && s.active === true && customerOfferingVisible(s))??null)}).catch(()=>{if(alive)setLoadError(true)}).finally(()=>{if(alive)setLoading(false)});return()=>{alive=false};
  },[serviceId,owner,retryTick]);
  useEffect(()=>{setVehicles([]);setSelectedVehicle(null);setVehiclesError(false);if(auth.status!=='ready'||!ownerKey)return;let alive=true,revision=0;const stop=listenToMyVehicles(ownerKey.key,auth.claims.tenantId,list=>{if(!alive)return;const rev=++revision;setVehicles(list);void AsyncStorage.getItem('autodeck.activeVehicle').then(activeId=>{if(alive&&revision===rev)setSelectedVehicle(cur=>{const keep=cur&&list.find(v=>v.id===cur.id);return keep??list.find(v=>v.id===activeId)??list[0]??null})}).catch(()=>{if(alive&&revision===rev)setSelectedVehicle(list[0]??null)})},()=>{if(alive)setVehiclesError(true)});return()=>{alive=false;stop()};},[owner,retryTick]);

  useEffect(()=>{setSelectedCategory(normalizeSegment(selectedVehicle?.category));setSizeError(null);},[selectedVehicle?.id,selectedVehicle?.category]);

  useEffect(() => {
    if (!serviceId || !service) return;
    const ids: string[] = [];
    const warm = peekAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7, ids);
    if (warm) setSlots(warm.filter(s=>Date.parse(s.startAt)>Date.now()));
    setSlotsLoading(!warm);
    setSlotsError(false);
    setPickedSlot(null);
    let alive = true;
    void getAvailability(serviceId, FIRST_STUDIO_ID, todayIST(), 7, ids)
      .then((r) => { if (alive) setSlots(r.filter(s=>Date.parse(s.startAt)>Date.now())); })
      .catch(() => { if (alive) setSlotsError(true); })
      .finally(() => { if (alive) setSlotsLoading(false); });
    return () => { alive = false; };
  }, [serviceId, service, retryTick]);

  useEffect(()=>{
    const want = day ? pickDay([...new Set(slots.map(s=>s.date))], day, todayIST()) : null;
    setDayMissed(!!day && slots.length>0 && !want);
    setSelectedDate(cur=>want ?? (slots.some(s=>s.date===cur)?cur:slots[0]?.date??null));
  },[slots,day]);

  async function handleSelectSlot(slot: AvailableSlot) {
    if (!selectedVehicle || !serviceId || sizeSaving) return;
    if (!selectedCategory || !selectedVehicle.category) { setSizeError("Add your car type to book. It is saved once with the car."); return; }
    const vehicleId=selectedVehicle.id;
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
  if (loadError) return <Screen><Notice title="Can't open booking" body="Check your connection and try again." action={<Button icon="refresh" label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /></Screen>;
  // Booking needs a verified customer record. Mirrors the quote-request
  // terminal account states: while auth resolves show a loading state (never a
  // false "Service not found"); a signed-out or claims-less session gets a
  // sign-in notice; staff/admin sign-ins (and a customer sign-in whose record
  // is not verified yet) get the honest gate, never the misleading
  // "Service not found" below - the service may exist; the account simply
  // cannot book.
  if (auth.status === "loading") return <Loading label="Checking your account" />;
  if (auth.status !== "ready") return <Screen><Notice title="Sign in to book" body="Your account session could not be verified." action={<Button label="Sign in" onPress={() => router.push("/login")} />} /></Screen>;
  if (!ownerKey) {
    // Resolution error is truthful unknown (retry), never an account denial.
    if (auth.customerDocResolution === "error") return <Screen><Notice title="Couldn't confirm your profile" body="Try again in a moment." action={<Button icon="refresh" label="Try again" onPress={() => setRetryTick((n) => n + 1)} />} /></Screen>;
    return <BookingRoleGate staff={auth.claims.role !== "customer"} onAccount={() => router.navigate("/(tabs)/profile")} onBrowse={() => router.navigate("/(tabs)/catalogue")} />;
  }
  if (!service || service.active === false) return <Screen><Notice title="Service not found" body="It may have been taken off the menu." /></Screen>;

  const slotsByDate = slots.reduce<Record<string, AvailableSlot[]>>((acc, slot) => {
    (acc[slot.date] ??= []).push(slot);
    return acc;
  }, {});

  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Book</Kicker><T role="title">{service.name}</T>{service.priceOnRequest === true ? <T role="caption" tone="accent">Quote on request</T> : total !== null ? <T role="bodyStrong" tone="accent">{rupees(total)} · {durationText(service.estimatedDurationMinutes)}</T> : null}</View>}>
      <View style={{ borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.10)" }}><ServicePhoto service={service} aspect={3} radius={0} /><View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(5,5,6,0) 50%, rgba(5,5,6,0.7) 100%)" } as object) }} /></View>
      <View style={{ gap: space.line }}>
        <Kicker>Booking for</Kicker>
        {selectedVehicle && vehicles.length <= 1 ? <Pane pad="inset"><View style={{flexDirection:"row",alignItems:"center",gap:14}}>{selectedVehicle.photoUrl?<CarThumb car={selectedVehicle} height={60} width={84} radius={12}/>:null}<View style={{flex:1,gap:6}}><T role="heading">{selectedVehicle.make} {selectedVehicle.model}</T><Plate value={selectedVehicle.registrationNumber}/></View></View></Pane> : null}
        {vehiclesError ? <Notice title="Can't load your cars" body="Try again before choosing a time." action={<Button icon="refresh" label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>}/> : vehicles.length === 0 ? (
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
        <Kicker>Car type needed</Kicker>
        <T role="caption" tone="secondary">This car has no type saved yet. Add it once in your garage, then book.</T>
        <Button label="Add car type" kind="quiet" onPress={() => router.push(`/(tabs)/garage/${selectedVehicle.id}`)} />
      </View>:selectedVehicle?.category?<T role="caption" tone="secondary">{segmentLabel(selectedVehicle.category)} · Saved with your car</T>:null}

      {combo ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Included</Kicker>
          <T role="body" tone="secondary">{combo.parts.join(" + ")}</T>
        </View>
      ) : null}


      <View style={{ gap: space.line }}>
        <Kicker>Choose a date</Kicker>
        {dayMissed ? <T role="caption" tone="secondary">No free time {day === "weekend" ? "this weekend" : day} for this service. Showing the earliest day instead.</T> : null}
        {slotsError ? <Notice title="Can't load times" body="Check your connection and try again." action={<Button icon="refresh" label="Retry" onPress={()=>setRetryTick(n=>n+1)}/>} /> : null}
        {slotsLoading ? (
          <View style={{ gap: space.line }}><View style={{ flexDirection: "row", gap: 8 }}><Skeleton height={40} width={110} /><Skeleton height={40} width={110} /></View><Skeleton height={150} /></View>
        ) : !slotsError && Object.keys(slotsByDate).length === 0 ? (
          <Notice title="Fully booked this week" body="No free times in the next 7 days. Try again tomorrow or call the studio." />
        ) : (
          <ServiceTimePicker key={selectedDate??'available'} slots={slots.filter(slot=>Date.parse(slot.startAt)>Date.now())} picked={pickedSlot} initialDate={selectedDate} onDayChange={date=>{setSelectedDate(date);setPickedSlot(null)}} onPick={slot=>{setPickedSlot(slot);setSizeError(null)}}/>
        )}
        {sizeError ? <T role="caption" tone="danger">{sizeError}</T> : null}
        <Button style={{alignSelf:"stretch",width:"100%",marginTop:16,marginBottom:16}} label={pickedSlot ? `Continue with ${pickedSlot.startTime}` : "Pick a time to continue"} disabled={!pickedSlot || !selectedVehicle || vehiclesError || sizeSaving} busy={sizeSaving} onPress={() => { if (pickedSlot) void handleSelectSlot(pickedSlot); }} />
      </View>
    </Screen>
  );
}

/** Honest terminal state for accounts that cannot book (see gate above). */
export function BookingRoleGate({ staff, onAccount, onBrowse }: { staff: boolean; onAccount: () => void; onBrowse: () => void }) {
  return (
    <Screen>
      <Notice
        title={staff ? "Booking uses a customer account" : "Customer profile could not be verified"}
        body={staff
          ? "You are signed in with a staff or admin account. You can browse services, but bookings need a customer account. Your staff access has not changed."
          : "We could not verify the customer profile linked to this sign-in. Your bookings have not been changed. Return to your account and try signing in again, or contact the studio."}
        action={<Button label="Go to your account" onPress={onAccount} />}
      />
      <Button label="Browse services" onPress={onBrowse} />
    </Screen>
  );
}
