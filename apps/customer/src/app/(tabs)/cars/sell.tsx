import { readPendingListing, writePendingListing, clearPendingListing } from "../../../lib/cars-pending";
import { randomUUID } from "expo-crypto";
import { FileUploader, SelectField } from "../../../ui/inputs";
// Sell your car: a short form plus photos. It goes to the studio for review first, then shows to other customers.
import { createElement, useEffect, useState, useRef } from "react";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";
import type { Vehicle } from "@autodeck/core";
import { useExperienceTheme } from "@autodeck/ui/native";
import { useAuth } from "../../../hooks/useAuth";
import { listenToMyVehicles } from "../../../lib/vehicle-service";
import { listOwnerKey } from "../../../lib/owner-key";
import { sellCarLabel, sellPrefillFromVehicle } from "../../../lib/sell-prefill";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Notice, Pane, Screen, T } from "../../../ui/kit";
import { getCarListings, getMyListingSubmission, submitMyListing, uploadListingPhoto, type SellInput } from "../../../lib/carsale-service";

import { validateSellStep, sellNumber, type SellForm as F, type SellErrors } from "../../../lib/sell-validation";

const FUELS = ["petrol", "diesel", "cng", "electric", "hybrid"];

export default function SellScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { name: themeName, colors: ink } = useExperienceTheme();
  const light = themeName === "light";
  const [garage, setGarage] = useState<Vehicle[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const uid = listOwnerKey(auth)?.key ?? null;
  const tenantId = auth.status === "ready" ? auth.claims.tenantId : null;
  useEffect(() => {
    setGarage([]);if (!uid || !tenantId) return;let alive=true;
    const stop=listenToMyVehicles(uid, tenantId, rows=>{if(alive)setGarage(rows)}, () => undefined);return()=>{alive=false;stop()};
  }, [uid, tenantId]);
  const [f, setF] = useState<F>({ make: "", model: "", variant: "", year: "", km: "", fuel: "petrol", gearbox: "manual", body: "", owners: "1", colour: "", area: "", price: "", description: "", name: "", phone: "", reg: "" });
  const [photos, setPhotos] = useState<Array<{ blob: Blob | Uint8Array; type: string }>>([]);
  const [previews,setPreviews] = useState<string[]>([]);
  useEffect(() => {
    if (Platform.OS!=="web") return;
    const urls=photos.map(p=>p.blob instanceof Uint8Array?"":URL.createObjectURL(p.blob));setPreviews(urls);
    return () => urls.forEach(u=>URL.revokeObjectURL(u));
  },[photos]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SellErrors>({});
  const [restoring, setRestoring] = useState(true);
  const [phase, setPhase] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState<SellInput | null>(null);
  const [done, setDone] = useState(false);
  const [step,setStep] = useState(0);
  const steps = ["Your car","Photos & price","Contact & review"];
  function next() {
    setError(null);
    const errors = validateSellStep(f, step, photos.length);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setStep(step+1);
  }
  const up = (k: keyof F, v: string) => { setF((p) => ({ ...p, [k]: v })); setFieldErrors((p) => ({ ...p, [k]: undefined })); };
  const n = sellNumber;

  const owner=JSON.stringify([uid,tenantId,auth.status==='ready'?auth.user.uid:null]);const ownerRef=useRef(owner);ownerRef.current=owner;const generation=useRef(0),submitLock=useRef(false);
  useEffect(()=>{generation.current++;submitLock.current=false;setBusy(false);setDone(false);setError(null);setPicked(null);setPhotos([]);setPhase(null);setUncertain(null);setStep(0);setF({make:'',model:'',variant:'',year:'',km:'',fuel:'petrol',gearbox:'manual',body:'',owners:'1',colour:'',area:'',price:'',description:'',name:'',phone:'',reg:''});return()=>{generation.current++}},[owner]);
  useEffect(()=>{
    let active=true;setRestoring(true);
    if(!uid||!tenantId){setRestoring(false);return;}
    readPendingListing(owner).then(payload=>{
      if(!active||ownerRef.current!==owner)return;
      if(payload){setUncertain(payload);setStep(2);setF({make:payload.make,model:payload.model,variant:payload.variant??'',year:String(payload.year),km:String(payload.kmDriven),fuel:payload.fuel,gearbox:payload.gearbox,body:payload.bodyType??'',owners:String(payload.owners),colour:payload.colour,area:payload.area,price:String(payload.askingPrice/100),description:payload.description??'',name:payload.sellerName,phone:payload.sellerPhone,reg:payload.registrationNumber??''});}
      setRestoring(false);
    }).catch(()=>{if(active){setError('Saved submission could not be checked. Do not send again yet.');setRestoring(true);}});
    return()=>{active=false;};
  },[owner,uid,tenantId]);
  async function submit() {
    if (busy) return;
    if (uncertain || restoring) return;
    if(submitLock.current)return;
    const digits=f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const errors = validateSellStep(f, 2, photos.length);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    const scope=owner,gen=generation.current;const current=()=>ownerRef.current===scope&&generation.current===gen;submitLock.current=true;setBusy(true); setError(null);
    let uploadComplete=false,submissionStarted=false;
    try {
      setPhase(`Uploading photos: 0/${photos.length}`);
      let uploaded = 0;
      const paths = await Promise.all(photos.map(async (p) => {
        const path = await uploadListingPhoto(p.blob, p.type);
        if (current()) setPhase(`Uploading photos: ${++uploaded}/${photos.length}`);
        return path;
      }));
      if(!current())return;
      uploadComplete=true;
      const payload: SellInput = {
        operationId: randomUUID(),
        make: f.make.trim(), model: f.model.trim(), variant: f.variant.trim() || null, year: n(f.year), kmDriven: n(f.km), fuel: f.fuel as never, gearbox: f.gearbox as never, bodyType: (f.body || null) as never,
        owners: Math.max(1, n(f.owners)), colour: f.colour.trim(), area: f.area.trim(), askingPrice: n(f.price) * 100, description: f.description.trim() || null, insuranceValidTill: null,
        photoPaths: paths, sellerName: f.name.trim(), sellerPhone: digits, registrationNumber: f.reg.trim().toUpperCase() || null,
      };
      setPhase("Sending to the studio");
      // If durable storage fails, never start an untracked create.
      await writePendingListing(scope,payload);
      if(!current())return;
      setUncertain(payload);
      submissionStarted=true;
      await submitMyListing(payload);
      if(current()){await clearPendingListing(scope);if(current()){setUncertain(null);setDone(true);}}
    } catch (e) {
      if(current())setError(submissionStarted ? "Submission not confirmed. Check your saved submission before sending again." : uploadComplete ? "Your draft could not be saved on this device. Nothing was sent. Try again." : "Photos could not finish uploading. Try again.");
    } finally { if(current()){submitLock.current=false;setBusy(false);setPhase(null);} }
  }

  async function checkSaved() {
    if (!uncertain || submitLock.current) return;
    const scope=owner,gen=generation.current;const current=()=>ownerRef.current===scope&&generation.current===gen;
    submitLock.current=true;setBusy(true);setError(null);
    try {
      if(uncertain.operationId){
        const outcome=await getMyListingSubmission(uncertain.operationId);
        if(!current())return;
        if(outcome.status==='committed'){
          await clearPendingListing(scope);
          if(current()){setUncertain(null);setDone(true);}
        }else setError('Not confirmed yet. Retry the same saved submission safely, without uploading again.');
      }else{
        // Legacy unknown outcomes have no server retry key. Never infer a match
        // from list contents or assign a new key to the old operation.
        await getCarListings(true);
        if(current())router.replace("/(tabs)/cars?tab=sell");
      }
    } catch {if(current())setError("Saved listings could not be checked. Do not send again yet.");}
    finally {if(current()){submitLock.current=false;setBusy(false);}}
  }
  async function retrySaved(){
    if(!uncertain?.operationId||submitLock.current||busy)return;
    const payload=uncertain,scope=owner,gen=generation.current;
    const current=()=>ownerRef.current===scope&&generation.current===gen;
    submitLock.current=true;setBusy(true);setError(null);setPhase('Retrying the same saved submission');
    try{await submitMyListing(payload);if(!current())return;await clearPendingListing(scope);if(current()){setUncertain(null);setDone(true);}}
    catch{if(current())setError('Still not confirmed. Your saved submission is kept. Check again or retry the same submission.');}
    finally{if(current()){submitLock.current=false;setBusy(false);setPhase(null);}}
  }
  if (done) {
    return (
      <Screen>
        <Notice title="Listing saved" body="Track status under Your cars for sale on the Cars page." action={<Button label="Done" onPress={() => router.replace("/(tabs)/cars?tab=sell")} />} />
      </Screen>
    );
  }
  return (
    <Screen appBar="Sell your car">
      <T tone="secondary">Add your car for studio review.</T>
      <View style={{flexDirection:"row",gap:8}}>{steps.map((label,i)=><View key={label} style={{flex:1,gap:8}}><View style={{height:3,backgroundColor:i<=step?"#EC8638":"rgba(128,128,136,0.35)",borderRadius:9999}}/><T role="caption" tone={i===step?"accent":"tertiary"}>{i+1}. {label}</T></View>)}</View>
      {step===0 && garage.length > 0 && <View style={{ gap: space.hair }}>
        <Kicker tone="accent">Pick your car</Kicker>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 8 }}>
          {[...garage.map((v) => ({ id: v.id as string | null, label: sellCarLabel(v), v })), { id: null as string | null, label: "Another car", v: null as Vehicle | null }].map((c) => {
            const on = picked === c.id;
            return (
              <Pressable key={c.id ?? "other"} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => { setPicked(c.id); if (c.v) setF((p) => ({ ...p, ...sellPrefillFromVehicle(c.v!) })); }} style={{ borderRadius: 9999, paddingHorizontal: 15, paddingVertical: 9, backgroundColor: on ? (light ? "#16181C" : "#B9A58C") : "rgba(128,128,128,0.14)" }}>
                <Text style={{ color: on ? (light ? "#F4F1EC" : "#16181C") : ink.textPrimary, fontSize: 13, fontWeight: "700" }}>{c.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>}
      {step===0 && <View style={{ gap: space.line }}>
        <Kicker>Your vehicle</Kicker>
        <Field editable={!busy && !uncertain && !restoring} label="Make" value={f.make} error={fieldErrors.make} onBlur={() => setFieldErrors((p) => ({ ...p, make: validateSellStep(f, step, photos.length).make }))} onChangeText={(v) => up("make", v)} placeholder="Tata" autoCapitalize="words" maxLength={50} />
        <Field editable={!busy && !uncertain && !restoring} label="Model" value={f.model} error={fieldErrors.model} onBlur={() => setFieldErrors((p) => ({ ...p, model: validateSellStep(f, step, photos.length).model }))} onChangeText={(v) => up("model", v)} placeholder="Nexon" autoCapitalize="words" maxLength={80} />
        <Field editable={!busy && !uncertain && !restoring} label="Variant (optional)" value={f.variant} error={fieldErrors.variant} onBlur={() => setFieldErrors((p) => ({ ...p, variant: validateSellStep(f, step, photos.length).variant }))} onChangeText={(v) => up("variant", v)} maxLength={80} />
        <Field editable={!busy && !uncertain && !restoring} label="Year" value={f.year} error={fieldErrors.year} onBlur={() => setFieldErrors((p) => ({ ...p, year: validateSellStep(f, step, photos.length).year }))} onChangeText={(v) => up("year", v)} keyboardType="numeric" placeholder="2021" maxLength={4} />
        <Field editable={!busy && !uncertain && !restoring} label="Kilometres driven" value={f.km} error={fieldErrors.km} onBlur={() => setFieldErrors((p) => ({ ...p, km: validateSellStep(f, step, photos.length).km }))} onChangeText={(v) => up("km", v)} keyboardType="numeric" maxLength={7} />
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Fuel</T>
          <SelectField label="Fuel" value={f.fuel} onChange={v=>up("fuel",v)} options={FUELS.map(x=>({value:x,label:x}))}/>
        </View>
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Gearbox</T>
          <SelectField label="Gearbox" value={f.gearbox} onChange={v=>up("gearbox",v)} options={["manual","automatic"].map(x=>({value:x,label:x}))}/>
        </View>
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Body type (optional)</T>
          <SelectField label="Body type" value={f.body} onChange={v=>up("body",v)} options={[{value:"",label:"Not sure"},...["hatchback","sedan","suv","muv","coupe","other"].map(x=>({value:x,label:x}))]}/>
        </View>
        <Field editable={!busy && !uncertain && !restoring} label="Owners so far" value={f.owners} error={fieldErrors.owners} onBlur={() => setFieldErrors((p) => ({ ...p, owners: validateSellStep(f, step, photos.length).owners }))} onChangeText={(v) => up("owners", v)} keyboardType="numeric" maxLength={2} />
        <Field editable={!busy && !uncertain && !restoring} label="Colour" value={f.colour} error={fieldErrors.colour} onBlur={() => setFieldErrors((p) => ({ ...p, colour: validateSellStep(f, step, photos.length).colour }))} onChangeText={(v) => up("colour", v)} autoCapitalize="words" maxLength={40} />
        <Field editable={!busy && !uncertain && !restoring} label="Area or city" value={f.area} error={fieldErrors.area} onBlur={() => setFieldErrors((p) => ({ ...p, area: validateSellStep(f, step, photos.length).area }))} onChangeText={(v) => up("area", v)} placeholder="Satellite, Ahmedabad" autoCapitalize="words" maxLength={60} />
      </View>}
      {step===1 && <View style={{gap:space.line}}><Kicker>Price and story</Kicker>
        <Field editable={!busy && !uncertain && !restoring} label="Asking price (rupees)" value={f.price} error={fieldErrors.price} onBlur={() => setFieldErrors((p) => ({ ...p, price: validateSellStep(f, step, photos.length).price }))} onChangeText={(v) => up("price", v)} keyboardType="numeric" maxLength={9} />
        <Field editable={!busy && !uncertain && !restoring} label="About the car (optional)" placeholder="Service history, owners, accidents, reason for selling - no phone numbers or links" value={f.description} error={fieldErrors.description} onBlur={() => setFieldErrors((p) => ({ ...p, description: validateSellStep(f, step, photos.length).description }))} onChangeText={(v) => up("description", v)} multiline maxLength={1000} />
      </View>}

      {step===1 ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Photos (up to 12, first is the cover)</Kicker>
          <FileUploader files={photos.filter((p):p is {blob:Blob;type:string}=>!(p.blob instanceof Uint8Array))} nativeEnabled nativeFileCount={photos.length} onNativeChange={fs=>{setPhotos(fs.map(p=>({blob:p.bytes,type:p.type})));setFieldErrors(p=>({...p,photos:undefined}));}} multiple maxFiles={12} onChange={fs=>{setPhotos(fs);setFieldErrors(p=>({...p,photos:undefined}));}}/>
          {fieldErrors.photos ? <T role="caption" tone="danger">{fieldErrors.photos}</T> : null}
          <T role="caption" tone="tertiary">{photos.length} photo{photos.length === 1 ? "" : "s"} selected. Use clear exterior and interior photos. Originals are kept unchanged.</T>
        </View>
      ) : null}

      {step===2 && <View style={{ gap: space.line }}>
        <Pane pad="gap"><T role="heading">{f.year} {f.make} {f.model}</T><T tone="accent">₹{n(f.price).toLocaleString("en-IN")}</T><T role="caption" tone="tertiary">{n(f.km).toLocaleString("en-IN")} km · {uncertain?.photoPaths.length ?? photos.length} photos · {f.area}</T></Pane>
        <Kicker>Only the studio sees these</Kicker>
        <Field editable={!busy && !uncertain && !restoring} label="Your name" value={f.name} error={fieldErrors.name} onBlur={() => setFieldErrors((p) => ({ ...p, name: validateSellStep(f, step, photos.length).name }))} onChangeText={(v) => up("name", v)} autoCapitalize="words" maxLength={80} />
        <Field editable={!busy && !uncertain && !restoring} label="Your phone" value={f.phone} error={fieldErrors.phone} onBlur={() => setFieldErrors((p) => ({ ...p, phone: validateSellStep(f, step, photos.length).phone }))} onChangeText={(v) => up("phone", v)} keyboardType="phone-pad" maxLength={15} />
        <Field editable={!busy && !uncertain && !restoring} label="Registration number (optional)" value={f.reg} error={fieldErrors.reg} onBlur={() => setFieldErrors((p) => ({ ...p, reg: validateSellStep(f, step, photos.length).reg }))} onChangeText={(v) => up("reg", v)} autoCapitalize="characters" maxLength={13} />
      </View>}
      {error ? <Notice title={uncertain ? "Submission not confirmed" : "Check these details"} body={error} /> : null}
      {phase ? <T role="caption" tone="secondary">{phase}</T> : null}
      {uncertain ? <T role="caption" tone="secondary">{uncertain.photoPaths.length} photos uploaded. Submission not confirmed.</T> : null}
      {uncertain?.operationId ? <Button label="Retry same submission" busy={busy} onPress={()=>void retrySaved()}/> : null}
      {uncertain ? <Button label={uncertain.operationId?'Check submission':'Check saved listings'} busy={busy} onPress={() => void checkSaved()}/> : step===2 ? <Button label="Send for studio review" busy={busy} disabled={restoring} onPress={() => void submit()}/> : <Button label={step===0 ? "Continue to photos & price" : "Continue to review"} onPress={next}/>}
      {step>0 && <Button kind="quiet" label="Previous step" disabled={busy || !!uncertain} onPress={() => {setError(null);setFieldErrors({});setStep(step-1);}}/>}
      <T role="caption" tone="tertiary">The studio reviews your listing. Your number is not shown to buyers.</T>
    </Screen>
  );
}
