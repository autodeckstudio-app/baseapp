// Sell your car: a short form plus photos. It goes to the studio for review first, then shows to other customers.
import { createElement, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Notice, Pane, Screen, T } from "../../../ui/kit";
import { submitMyListing, uploadListingPhoto } from "../../../lib/carsale-service";

type F = { make: string; model: string; variant: string; year: string; km: string; fuel: string; gearbox: string; body: string; owners: string; colour: string; area: string; price: string; description: string; name: string; phone: string; reg: string };
const FUELS = ["petrol", "diesel", "cng", "electric", "hybrid"];

export default function SellScreen() {
  const router = useRouter();
  const [f, setF] = useState<F>({ make: "", model: "", variant: "", year: "", km: "", fuel: "petrol", gearbox: "manual", body: "", owners: "1", colour: "", area: "", price: "", description: "", name: "", phone: "", reg: "" });
  const [photos, setPhotos] = useState<Array<{ blob: Blob; type: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [step,setStep] = useState(0);
  const steps = ["Your car","Photos & price","Contact & review"];
  function next() {
    setError(null);
    const year = n(f.year);
    if (step===0 && (!f.make.trim() || !f.model.trim() || year<1990 || year>new Date().getFullYear()+1 || !f.km.trim() || !f.colour.trim() || !f.area.trim() || n(f.owners)<1 || n(f.owners)>10)) {setError("Add the make, model, year, mileage, colour, area and owner count before continuing.");return;}
    if (step===1 && (photos.length===0 || n(f.price)<1000)) {setError("Add at least one photo and an asking price of ₹1,000 or more.");return;}
    setStep(step+1);
  }
  const up = (k: keyof F, v: string) => setF((p) => ({ ...p, [k]: v }));
  const n = (s: string) => Number(s.replace(/[^0-9]/g, ""));

  async function submit() {
    if (busy) return;
    const digits=f.phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "");
    if (!f.name.trim() || !/^[6-9]\d{9}$/.test(digits)) { setError("Add your name and a valid 10-digit mobile number."); return; }
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
    <Screen top={<View style={{ gap: space.hair }}><Kicker tone="accent">Sell your car</Kicker><T role="title">Make the next move</T></View>}>
      <T tone="secondary">A clear listing starts with your car's story. The studio reviews it before buyers see it.</T>
      <View style={{flexDirection:"row",gap:8}}>{steps.map((label,i)=><View key={label} style={{flex:1,gap:8}}><View style={{height:3,backgroundColor:i<=step?"#F59A45":"#353538",borderRadius:2}}/><T role="caption" tone={i===step?"accent":"tertiary"}>{i+1}. {label}</T></View>)}</View>
      {step===0 && <View style={{ gap: space.line }}>
        <Kicker>Your vehicle</Kicker>
        <Field label="Make" value={f.make} onChangeText={(v) => up("make", v)} placeholder="Tata" autoCapitalize="words" maxLength={50} />
        <Field label="Model" value={f.model} onChangeText={(v) => up("model", v)} placeholder="Nexon" autoCapitalize="words" maxLength={80} />
        <Field label="Variant (optional)" value={f.variant} onChangeText={(v) => up("variant", v)} maxLength={80} />
        <Field label="Year" value={f.year} onChangeText={(v) => up("year", v)} keyboardType="numeric" placeholder="2021" maxLength={4} />
        <Field label="Kilometres driven" value={f.km} onChangeText={(v) => up("km", v)} keyboardType="numeric" maxLength={7} />
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Fuel</T>
          {Platform.OS === "web" ? createElement("select", { value: f.fuel, onChange: (e: { target: { value: string } }) => up("fuel", e.target.value), style: { padding: 14, borderRadius: 12, fontSize: 15, minHeight:48,background:"#1E1E21",color:"#F6F4F1",border:"1px solid #454548",width:"100%" } }, FUELS.map((x) => createElement("option", { key: x, value: x }, x))) : null}
        </View>
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Gearbox</T>
          {Platform.OS === "web" ? createElement("select", { value: f.gearbox, onChange: (e: { target: { value: string } }) => up("gearbox", e.target.value), style: { padding: 14, borderRadius: 12, fontSize: 15, minHeight:48,background:"#1E1E21",color:"#F6F4F1",border:"1px solid #454548",width:"100%" } }, ["manual", "automatic"].map((x) => createElement("option", { key: x, value: x }, x))) : null}
        </View>
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Body type (optional)</T>
          {Platform.OS === "web" ? createElement("select", { value: f.body, onChange: (e: { target: { value: string } }) => up("body", e.target.value), style: { padding: 14, borderRadius: 12, fontSize: 15, minHeight:48,background:"#1E1E21",color:"#F6F4F1",border:"1px solid #454548",width:"100%" } }, [createElement("option", { key: "", value: "" }, "Not sure"), ...["hatchback", "sedan", "suv", "muv", "coupe", "other"].map((x) => createElement("option", { key: x, value: x }, x))]) : null}
        </View>
        <Field label="Owners so far" value={f.owners} onChangeText={(v) => up("owners", v)} keyboardType="numeric" maxLength={2} />
        <Field label="Colour" value={f.colour} onChangeText={(v) => up("colour", v)} autoCapitalize="words" maxLength={40} />
        <Field label="Area or city" value={f.area} onChangeText={(v) => up("area", v)} placeholder="Satellite, Ahmedabad" autoCapitalize="words" maxLength={60} />
      </View>}
      {step===1 && <View style={{gap:space.line}}><Kicker>Price and story</Kicker>
        <Field label="Asking price (rupees)" value={f.price} onChangeText={(v) => up("price", v)} keyboardType="numeric" maxLength={9} />
        <Field label="About the car (no phone numbers or links)" value={f.description} onChangeText={(v) => up("description", v)} multiline maxLength={1000} />
      </View>}

      {step===1 && Platform.OS === "web" ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Photos (up to 12, first is the cover)</Kicker>
          {createElement("input", {
            type: "file", multiple: true, accept: "image/jpeg,image/png,image/webp",
            onChange: (e: { target: { files: ArrayLike<{ type: string }> | null } }) => {
              const list = Array.from(e.target.files ?? []).filter((x) => ["image/jpeg", "image/png", "image/webp"].includes(x.type)).slice(0, 12);
              setPhotos(list.map((x) => ({ blob: x as unknown as Blob, type: x.type })));
            },
          })}
          <T role="caption" tone="tertiary">{photos.length} photo{photos.length === 1 ? "" : "s"} selected. Use clear exterior and interior photos. Originals are kept unchanged.</T>
        </View>
      ) : null}

      {step===2 && <View style={{ gap: space.line }}>
        <Pane pad="gap"><T role="heading">{f.year} {f.make} {f.model}</T><T tone="accent">₹{n(f.price).toLocaleString("en-IN")}</T><T role="caption" tone="tertiary">{n(f.km).toLocaleString("en-IN")} km · {photos.length} photos · {f.area}</T></Pane>
        <Kicker>Only the studio sees these</Kicker>
        <Field label="Your name" value={f.name} onChangeText={(v) => up("name", v)} autoCapitalize="words" maxLength={80} />
        <Field label="Your phone" value={f.phone} onChangeText={(v) => up("phone", v)} keyboardType="phone-pad" maxLength={15} />
        <Field label="Registration number (optional)" value={f.reg} onChangeText={(v) => up("reg", v)} autoCapitalize="characters" maxLength={13} />
      </View>}
      {error ? <Notice title="Not sent" body={error} /> : null}
      {step===2 ? <Button label="Send for studio review" busy={busy} onPress={() => void submit()}/> : <Button label={step===0 ? "Continue to photos & price" : "Continue to review"} onPress={next}/>}
      {step>0 && <Button kind="quiet" label="Previous step" disabled={busy} onPress={() => {setError(null);setStep(step-1);}}/>}
      <T role="caption" tone="tertiary">We check that you are the registered owner before approving. Your phone number is never shown to buyers.</T>
    </Screen>
  );
}
