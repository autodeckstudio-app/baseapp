// Gifts: enter a code you were given, and see the gifts you bought. Empty until GIFT_LIVE. Buying is added when payments are live.
import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { normaliseGiftCode } from "@autodeck/core";
import { Button, Field, Kicker, Notice, Pane, Row, Screen, T } from "../../ui/kit";
import { GIFT_LIVE, GIFT_SERVICE_ROUTE, GIFT_STATE_LABEL, setPendingGiftCode } from "../../lib/gift";
import { cancelMyGift, claimGift, listMyGifts, type GiftView } from "../../lib/gift-service";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

export default function GiftsScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<GiftView | null>(null);
  const [gifts, setGifts] = useState<GiftView[]>([]);
  const load = useCallback(() => { void listMyGifts().then(setGifts).catch(() => undefined); }, []);
  useEffect(() => { if (GIFT_LIVE) load(); }, [load]);
  if (!GIFT_LIVE) return <Screen header={<T role="title">Gifts</T>}><Notice title="Coming soon" body="Gifting a wash will be here soon." /></Screen>;

  async function redeem() {
    const c = normaliseGiftCode(code);
    if (!c) { setError("That does not look like a gift code. It starts with GW."); return; }
    setBusy(true); setError(null);
    try { const g = await claimGift(c); setClaimed(g); setPendingGiftCode(c); setCode(""); }
    catch (e) { setError((e as { message?: string }).message || "That code did not work. Check it and try again."); }
    finally { setBusy(false); }
  }
  async function cancel(id: string) {
    setBusy(true); setError(null);
    try { await cancelMyGift(id); load(); } catch (e) { setError((e as { message?: string }).message || "Could not cancel. Please call the studio."); } finally { setBusy(false); }
  }
  return (
    <Screen header={<View style={{ gap: space.hair }}><Kicker tone="accent">Gifts</Kicker><T role="title">Gift a wash</T></View>}>
      <Pane pad="gap">
        <T role="heading">Got a gift code?</T>
        <Field label="Gift code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="GW-XXXX-XXXX" maxLength={14} {...(error ? { error } : {})} />
        <Button label="Use this code" onPress={() => void redeem()} disabled={busy || code.trim() === ""} />
      </Pane>
      {claimed ? (
        <Notice title="Your gift is ready" body={`A foam wash for any car. Use it by ${day(claimed.expiresAt)}.`} action={<Button label="Book your wash" onPress={() => router.push(GIFT_SERVICE_ROUTE as never)} />} />
      ) : null}
      {gifts.length > 0 ? (
        <>
          <Kicker>Gifts you bought</Kicker>
          <Pane pad="gap">
            {gifts.map((g, i) => (
              <Row key={g.id} title={`Gift ending ${g.tail}`} detail={`${g.refundRequested ? "Refund requested" : GIFT_STATE_LABEL[g.state]}${g.expiresAt && g.state === "unused" ? ` - until ${day(g.expiresAt)}` : ""}`} last={i === gifts.length - 1}
                {...(g.refundable ? { onPress: () => void cancel(g.id) } : {})} />
            ))}
          </Pane>
          {gifts.some((g) => g.refundable) ? <T role="caption">Tap an unused gift to cancel it for a refund.</T> : null}
        </>
      ) : null}
    </Screen>
  );
}
