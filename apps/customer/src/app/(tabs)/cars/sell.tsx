// Sell your car: a short form plus photos. It goes to the studio for review first, then shows to other customers.
import { createElement, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Notice, Screen, T } from "../../../ui/kit";
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
  const up = (k: keyof F, v: string) => setF((p) => ({ ...p, [k]: v }));
  const n = (s: string) => Number(s.replace(/[^0-9]/g, ""));

  async function submit() {
    setBusy(true); setError(null);
    try {
      const paths = await Promise.all(photos.map((p) => uploadListingPhoto(p.blob, p.type)));
      await submitMyListing({
        make: f.make.trim(), model: f.model.trim(), variant: f.variant.trim() || null, year: n(f.year), kmDriven: n(f.km), fuel: f.fuel as never, gearbox: f.gearbox as never, bodyType: (f.body || null) as never,
        owners: Math.max(1, n(f.owners)), colour: f.colour.trim(), area: f.area.trim(), askingPrice: n(f.price) * 100, description: f.description.trim() || null, insuranceValidTill: null,
        photoPaths: paths, sellerName: f.name.trim(), sellerPhone: f.phone.trim(), registrationNumber: f.reg.trim().toUpperCase() || null,
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
    <Screen top={<View style={{ gap: space.hair }}><Kicker tone="accent">Sell your car</Kicker><T role="title">Tell us about it</T></View>}>
      <View style={{ gap: space.line }}>
        <Field label="Make" value={f.make} onChangeText={(v) => up("make", v)} placeholder="Tata" autoCapitalize="words" maxLength={50} />
        <Field label="Model" value={f.model} onChangeText={(v) => up("model", v)} placeholder="Nexon" autoCapitalize="words" maxLength={80} />
        <Field label="Variant (optional)" value={f.variant} onChangeText={(v) => up("variant", v)} maxLength={80} />
        <Field label="Year" value={f.year} onChangeText={(v) => up("year", v)} keyboardType="numeric" placeholder="2021" maxLength={4} />
        <Field label="Kilometres driven" value={f.km} onChangeText={(v) => up("km", v)} keyboardType="numeric" maxLength={7} />
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Fuel</T>
          {Platform.OS === "web" ? createElement("select", { value: f.fuel, onChange: (e: { target: { value: string } }) => up("fuel", e.target.value), style: { padding: 12, borderRadius: 14, fontSize: 15 } }, FUELS.map((x) => createElement("option", { key: x, value: x }, x))) : null}
        </View>
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Gearbox</T>
          {Platform.OS === "web" ? createElement("select", { value: f.gearbox, onChange: (e: { target: { value: string } }) => up("gearbox", e.target.value), style: { padding: 12, borderRadius: 14, fontSize: 15 } }, ["manual", "automatic"].map((x) => createElement("option", { key: x, value: x }, x))) : null}
        </View>
        <View style={{ gap: space.hair }}>
          <T role="label" tone="tertiary">Body type (optional)</T>
          {Platform.OS === "web" ? createElement("select", { value: f.body, onChange: (e: { target: { value: string } }) => up("body", e.target.value), style: { padding: 12, borderRadius: 14, fontSize: 15 } }, [createElement("option", { key: "", value: "" }, "Not sure"), ...["hatchback", "sedan", "suv", "muv", "coupe", "other"].map((x) => createElement("option", { key: x, value: x }, x))]) : null}
        </View>
        <Field label="Owners so far" value={f.owners} onChangeText={(v) => up("owners", v)} keyboardType="numeric" maxLength={2} />
        <Field label="Colour" value={f.colour} onChangeText={(v) => up("colour", v)} autoCapitalize="words" maxLength={40} />
        <Field label="Area or city" value={f.area} onChangeText={(v) => up("area", v)} placeholder="Satellite, Ahmedabad" autoCapitalize="words" maxLength={60} />
        <Field label="Asking price (rupees)" value={f.price} onChangeText={(v) => up("price", v)} keyboardType="numeric" maxLength={9} />
        <Field label="About the car (no phone numbers or links)" value={f.description} onChangeText={(v) => up("description", v)} multiline maxLength={1000} />
      </View>

      {Platform.OS === "web" ? (
        <View style={{ gap: space.hair }}>
          <Kicker>Photos (up to 12, first is the cover)</Kicker>
          {createElement("input", {
            type: "file", multiple: true, accept: "image/jpeg,image/png,image/webp",
            onChange: (e: { target: { files: ArrayLike<{ type: string }> | null } }) => {
              const list = Array.from(e.target.files ?? []).filter((x) => ["image/jpeg", "image/png", "image/webp"].includes(x.type)).slice(0, 12);
              setPhotos(list.map((x) => ({ blob: x as unknown as Blob, type: x.type })));
            },
          })}
          <T role="caption" tone="tertiary">{photos.length} photo{photos.length === 1 ? "" : "s"} ready. Please hide the number plate if you can.</T>
        </View>
      ) : null}

      <View style={{ gap: space.line }}>
        <Kicker>Only the studio sees these</Kicker>
        <Field label="Your name" value={f.name} onChangeText={(v) => up("name", v)} autoCapitalize="words" maxLength={80} />
        <Field label="Your phone" value={f.phone} onChangeText={(v) => up("phone", v)} keyboardType="phone-pad" maxLength={15} />
        <Field label="Registration number (optional)" value={f.reg} onChangeText={(v) => up("reg", v)} autoCapitalize="characters" maxLength={13} />
      </View>
      {error ? <Notice title="Not sent" body={error} /> : null}
      <Button label="Send for review" busy={busy} onPress={() => void submit()} />
      <T role="caption" tone="tertiary">We check that you are the registered owner before approving. Your phone number is never shown to buyers.</T>
    </Screen>
  );
}
