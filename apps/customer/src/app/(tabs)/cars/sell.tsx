import { FileUploader, SelectField } from "../../../ui/inputs";
// Sell your car: a short form plus photos. It goes to the studio for review first, then shows to other customers.
import { createElement, useEffect, useState } from "react";
import { Image, Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Notice, Pane, Screen, T } from "../../../ui/kit";
import { submitMyListing, uploadListingPhoto } from "../../../lib/carsale-service";

import { validateSellStep, sellNumber, type SellForm as F, type SellErrors } from "../../../lib/sell-validation";

const FUELS = ["petrol", "diesel", "cng", "electric", "hybrid"];

export default function SellScreen() {
  const router = useRouter();
  const [f, setF] = useState<F>({ make: "", model: "", variant: "", year: "", km: "", fuel: "petrol", gearbox: "manual", body: "", owners: "1", colour: "", area: "", price: "", description: "", name: "", phone: "", reg: "" });
  const [photos, setPhotos] = useState<Array<{ blob: Blob; type: string }>>([]);
  const [previews,setPreviews] = useState<string[]>([]);
  useEffect(() => {
    if (Platform.OS!=="web") return;
    const urls=photos.map(p=>URL.createObjectURL(p.blob));setPreviews(urls);
    return () => urls.forEach(u=>URL.revokeObjectURL(u));
  },[photos]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SellErrors>({});
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

  async function submit() {
    if (busy) return;
    const digits=f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    const errors = validateSellStep(f, 2, photos.length);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true); setError(null);
    try {
      const paths = await Promise.all(photos.map((p) => uploadListingPhoto(p.blob, p.type)));
      await submitMyListing({
        make: f.make.trim(), model: f.model.trim(), variant: f.variant.trim() || null, year: n(f.year), kmDriven: n(f.km), fuel: f.fuel as never, gearbox: f.gearbox as never, bodyType: (f.body || null) as never,
        owners: Math.max(1, n(f.owners)), colour: f.colour.trim(), area: f.area.trim(), askingPrice: n(f.price) * 100, description: f.description.trim() || null, insuranceValidTill: null,
        photoPaths: paths, sellerName: f.name.trim(), sellerPhone: digits, registrationNumber: f.reg.trim().toUpperCase() || null,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <Screen>
        <Notice title="Sent for review" body="The studio checks every car before it shows to other customers. You will see its status under Cars for sale." action={<Button label="Done" onPress={() => router.replace("/(tabs)/cars")} />} />
      </Screen>
    );
  }
  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Sell your car</Kicker><T role="title">Make the next move</T></View>}>
      <T tone="secondary">A clear listing starts with your car's story. The studio reviews it before buyers see it.</T>
      <View style={{flexDirection:"row",gap:8}}>{steps.map((label,i)=><View key={label} style={{flex:1,gap:8}}><View style={{height:3,backgroundColor:i<=step?"#F59A45":"#353538",borderRadius:2}}/><T role="caption" tone={i===step?"accent":"tertiary"}>{i+1}. {label}</T></View>)}</View>
      {step===0 && <View style={{ gap: space.line }}>
        <Kicker>Your vehicle</Kicker>
        <Field label="Make" value={f.make} error={fieldErrors.make} onBlur={() => setFieldErrors((p) => ({ ...p, make: validateSellStep(f, step, photos.length).make }))} onChangeText={(v) => up("make", v)} placeholder="Tata" autoCapitalize="words" maxLength={50} />
        <Field label="Model" value={f.model} error={fieldErrors.model} onBlur={() => setFieldErrors((p) => ({ ...p, model: validateSellStep(f, step, photos.length).model }))} onChangeText={(v) => up("model", v)} placeholder="Nexon" autoCapitalize="words" maxLength={80} />
        <Field label="Variant (optional)" value={f.variant} error={fieldErrors.variant} onBlur={() => setFieldErrors((p) => ({ ...p, variant: validateSellStep(f, step, photos.length).variant }))} onChangeText={(v) => up("variant", v)} maxLength={80} />
        <Field label="Year" value={f.year} error={fieldErrors.year} onBlur={() => setFieldErrors((p) => ({ ...p, year: validateSellStep(f, step, photos.length).year }))} onChangeText={(v) => up("year", v)} keyboardType="numeric" placeholder="2021" maxLength={4} />
        <Field label="Kilometres driven" value={f.km} error={fieldErrors.km} onBlur={() => setFieldErrors((p) => ({ ...p, km: validateSellStep(f, step, photos.length).km }))} onChangeText={(v) => up("km", v)} keyboardType="numeric" maxLength={7} />
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
        <Field label="Owners so far" value={f.owners} error={fieldErrors.owners} onBlur={() => setFieldErrors((p) => ({ ...p, owners: validateSellStep(f, step, photos.length).owners }))} onChangeText={(v) => up("owners", v)} keyboardType="numeric" maxLength={2} />
        <Field label="Colour" value={f.colour} error={fieldErrors.colour} onBlur={() => setFieldErrors((p) => ({ ...p, colour: validateSellStep(f, step, photos.length).colour }))} onChangeText={(v) => up("colour", v)} autoCapitalize="words" maxLength={40} />
        <Field label="Area or city" value={f.area} error={fieldErrors.area} onBlur={() => setFieldErrors((p) => ({ ...p, area: validateSellStep(f, step, photos.length).area }))} onChangeText={(v) => up("area", v)} placeholder="Satellite, Ahmedabad" autoCapitalize="words" maxLength={60} />
      </View>}
      {step===1 && <View style={{gap:space.line}}><Kicker>Price and story</Kicker>
        <Field label="Asking price (rupees)" value={f.price} error={fieldErrors.price} onBlur={() => setFieldErrors((p) => ({ ...p, price: validateSellStep(f, step, photos.length).price }))} onChangeText={(v) => up("price", v)} keyboardType="numeric" maxLength={9} />
        <Field label="About the car (optional)" placeholder="Service history, owners, accidents, reason for selling - no phone numbers or links" value={f.description} error={fieldErrors.description} onBlur={() => setFieldErrors((p) => ({ ...p, description: validateSellStep(f, step, photos.length).description }))} onChangeText={(v) => up("description", v)} multiline maxLength={1000} />
      </View>}

      {step===1 && Platform.OS === "web" ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Photos (up to 12, first is the cover)</Kicker>
          <FileUploader files={photos} multiple maxFiles={12} onChange={fs=>{setPhotos(fs);setFieldErrors(p=>({...p,photos:undefined}));}}/>
          {fieldErrors.photos ? <T role="caption" tone="danger">{fieldErrors.photos}</T> : null}
          <T role="caption" tone="tertiary">{photos.length} photo{photos.length === 1 ? "" : "s"} selected. Use clear exterior and interior photos. Originals are kept unchanged.</T>
        </View>
      ) : null}

      {step===2 && <View style={{ gap: space.line }}>
        <Pane pad="gap"><T role="heading">{f.year} {f.make} {f.model}</T><T tone="accent">₹{n(f.price).toLocaleString("en-IN")}</T><T role="caption" tone="tertiary">{n(f.km).toLocaleString("en-IN")} km · {photos.length} photos · {f.area}</T></Pane>
        <Kicker>Only the studio sees these</Kicker>
        <Field label="Your name" value={f.name} error={fieldErrors.name} onBlur={() => setFieldErrors((p) => ({ ...p, name: validateSellStep(f, step, photos.length).name }))} onChangeText={(v) => up("name", v)} autoCapitalize="words" maxLength={80} />
        <Field label="Your phone" value={f.phone} error={fieldErrors.phone} onBlur={() => setFieldErrors((p) => ({ ...p, phone: validateSellStep(f, step, photos.length).phone }))} onChangeText={(v) => up("phone", v)} keyboardType="phone-pad" maxLength={15} />
        <Field label="Registration number (optional)" value={f.reg} error={fieldErrors.reg} onBlur={() => setFieldErrors((p) => ({ ...p, reg: validateSellStep(f, step, photos.length).reg }))} onChangeText={(v) => up("reg", v)} autoCapitalize="characters" maxLength={13} />
      </View>}
      {error ? <Notice title="Check these details" body={error} /> : null}
      {step===2 ? <Button label="Send for studio review" busy={busy} onPress={() => void submit()}/> : <Button label={step===0 ? "Continue to photos & price" : "Continue to review"} onPress={next}/>}
      {step>0 && <Button kind="quiet" label="Previous step" disabled={busy} onPress={() => {setError(null);setFieldErrors({});setStep(step-1);}}/>}
      <T role="caption" tone="tertiary">We check that you are the registered owner before approving. Your phone number is never shown to buyers.</T>
    </Screen>
  );
}
