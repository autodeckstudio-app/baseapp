// One car: photos, plain facts, "I'm interested" (goes to the studio, never to the seller) and "Report this listing".
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { CarListingView } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Field, Kicker, Notice, Pane, Screen, Skeleton, T } from "../../../ui/kit";
import { getCarListings, inr, kmLabel, markListingSold, sendCarLead } from "../../../lib/carsale-service";

export default function CarDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [car, setCar] = useState<CarListingView | null | undefined>(undefined);
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState<null | "interest" | "report">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    Promise.all([getCarListings(false), getCarListings(true)])
      .then(([a, b]) => setCar([...a, ...b].find((x) => x.id === id) ?? null))
      .catch(() => setCar(null));
  }, [id]);

  async function markSold() {
    if (!car) return;
    setBusy(true); setError(null);
    try {
      await markListingSold(car.id);
      setCar({ ...car, status: "sold" });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    } finally { setBusy(false); }
  }

  async function send(kind: "interest" | "report") {
    if (!car) return;
    setBusy(true); setError(null);
    try {
      await sendCarLead(car.id, kind, phone.trim() || undefined, note.trim() || undefined);
      setSent(kind);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "That did not go through. Try again.");
    } finally { setBusy(false); }
  }

  if (car === undefined) return <Screen><Skeleton height={300} /><Skeleton height={120} /></Screen>;
  if (car === null) return <Screen><Notice title="Car not found" body="It may have been sold or taken down." action={<Button kind="quiet" label="Back to cars" onPress={() => router.replace("/(tabs)/cars")} />} /></Screen>;

  const facts: Array<[string, string]> = [["Year", String(car.year)], ["Driven", kmLabel(car.kmDriven)], ["Fuel", car.fuel], ["Gearbox", car.gearbox], ...(car.bodyType ? [["Body", car.bodyType] as [string, string]] : []), ["Owners", String(car.owners)], ["Colour", car.colour], ["Area", car.area], ...(car.insuranceValidTill ? [["Insurance till", car.insuranceValidTill] as [string, string]] : [])];

  return (
    <Screen>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ borderRadius: 26 }}>
        {car.photoUrls.map((u) => (
          <Image key={u} source={{ uri: u }} resizeMode="cover" style={{ width: 340, maxWidth: "100%", aspectRatio: 4 / 3, borderRadius: 26, marginRight: 8 }} />
        ))}
      </ScrollView>
      <View style={{ gap: 4 }}>
        <Kicker tone="accent">{car.status === "reserved" ? "Reserved" : car.status === "live" ? "For sale" : car.status}</Kicker>
        <T role="title" numberOfLines={2}>{car.year} {car.make} {car.model}{car.variant ? ` ${car.variant}` : ""}</T>
        <T role="display" tone="accent">{inr(car.askingPrice)}</T>
      </View>
      <Pane pad="inset">
        <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: space.line }}>
          {facts.map(([k, v]) => (
            <View key={k} style={{ width: "50%", gap: 2 }}>
              <T role="caption" tone="tertiary">{k}</T>
              <T role="bodyStrong" numberOfLines={1} style={{ textTransform: "capitalize" }}>{v}</T>
            </View>
          ))}
        </View>
      </Pane>
      {car.description ? <T tone="secondary">{car.description}</T> : null}

      {car.mine && (car.status === "live" || car.status === "reserved" || car.status === "pending") ? (
        <View style={{ gap: space.line }}>
          {error ? <Notice title="Not done" body={error} /> : null}
          <Button kind="quiet" label="Mark as sold" busy={busy} onPress={() => void markSold()} />
        </View>
      ) : null}
      {car.mine ? (
        <Notice title={car.status === "pending" ? "Waiting for review" : car.status === "rejected" ? "Not approved" : "Your listing"} body={car.status === "pending" ? "The studio checks every car before it shows to others." : car.status === "sold" ? "Marked as sold. It is no longer shown to other customers." : car.rejectionReason ?? "Live for other customers."} />
      ) : sent === "interest" ? (
        <Notice title="Sent to the studio" body="The studio will call you. Your number is not shared with the seller." />
      ) : sent === "report" ? (
        <Notice title="Thanks, we will look at it" />
      ) : (
        <View style={{ gap: space.breath }}>
          <Field label="Your phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="So the studio can reach you" maxLength={15} />
          <Field label="Message (optional)" value={note} onChangeText={setNote} maxLength={300} />
          {error ? <Notice title="Not sent" body={error} /> : null}
          <Button label="I'm interested" busy={busy} onPress={() => void send("interest")} />
          {showReport ? (
            <Button kind="quiet" label="Send report" busy={busy} onPress={() => void send("report")} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setShowReport(true)}><T role="caption" tone="tertiary">Report this listing</T></Pressable>
          )}
        </View>
      )}
      <T role="caption" tone="tertiary">AutoDeck lists cars to help buyers and sellers meet. Check papers, loans and ownership before you pay anyone. We are not a party to the sale.</T>
    </Screen>
  );
}
