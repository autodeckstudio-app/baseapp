// Gifts: buy a foam wash for someone (pay, then get the code to share), enter a code you were given, and see the gifts you bought.
// Empty until GIFT_LIVE. A gift is valid 60 days from payment and cannot be refunded; both are said before the pay button.
import { useCallback, useEffect, useRef, useState } from "react";
import { Share, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { GIFT_TERMS, giftDaysLeft, giftValidityLine, normaliseGiftCode } from "@autodeck/core";
import { Button, Field, Kicker, Notice, Pane, Row, Screen, T, rupees } from "../../ui/kit";
import { GiftCard } from "../../ui/GiftCard";
import { GiftBuy } from "../../ui/GiftBuy";
import { GIFT_LIVE, GIFT_SERVICE_ROUTE, GIFT_STATE_LABEL, setPendingGiftCode } from "../../lib/gift";
import { claimGift, fetchGiftCode, listMyGifts, startGiftPurchase, requestGiftPaymentLink, type GiftOffer, type GiftView } from "../../lib/gift-service";
import { checkoutSupported, payOnline } from "../../lib/razorpay-checkout";
import { NATIVE_GIFT_PAYMENT_ENABLED } from "../../lib/native-gift-availability";
import { referralCodeFor, referralShareMessage, referralSubtitle } from "../../lib/referral";
import { useAuth } from "../../hooks/useAuth";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "");
const msg = (e: unknown, fallback: string) => (e as { message?: string }).message || fallback;

export default function GiftsScreen() {
  const router = useRouter();
  const auth = useAuth();
  const buyerName = auth.status === "ready" ? auth.user.displayName ?? null : null;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<GiftView | null>(null);
  const [gifts, setGifts] = useState<GiftView[]>([]);
  const [offer, setOffer] = useState<GiftOffer | null>(null);
  const [card, setCard] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const buyBusy = useRef(false);
  const load = useCallback(() => {
    setLoadFailed(false);
    void listMyGifts().then((r) => { setGifts(r.gifts); setOffer(r.offer); }).catch(() => setLoadFailed(true));
  }, []);
  useEffect(() => { if (GIFT_LIVE) load(); }, [load]);
  const referralCode = auth.status === "ready" ? referralCodeFor(auth.user.uid) : null;
  const friendPanel = <Pane pad="gap"><T role="heading">Bring a friend</T><T tone="secondary">{referralSubtitle(referralCode)}</T><Button icon="share" label="Share AutoDeck" onPress={() => void Share.share({ message: referralShareMessage(referralCode) }).catch(() => undefined)} /></Pane>;
  if (!GIFT_LIVE) return <Screen appBar="Friends & gifts">{friendPanel}<Notice title="Gift a wash" body="Wash gifting is not available yet." /></Screen>;

  async function buy() {
    if (!checkoutSupported && !NATIVE_GIFT_PAYMENT_ENABLED) { setInfo("Buying a gift is not available in this app build yet. Use app.autodeck.in."); return; }
    if (buyBusy.current) return; // double-tap: one in-flight purchase; the server slot is the second line
    buyBusy.current = true;
    setBusy(true); setError(null); setInfo(null); setCard(null);
    try {
      const g = await startGiftPurchase();
      const link = checkoutSupported ? null : await requestGiftPaymentLink(g.paymentId);
      if (link && !link.paymentUrl) { setInfo("Your earlier payment is being checked. Contact the studio before trying again."); load(); return; }
      const r = await payOnline({ paymentId: g.paymentId, paymentUrl: link?.paymentUrl ?? null, name: "AutoDeck Studio", description: "Gift: foam wash" });
      if (r === "dismissed") { setInfo("The payment was not completed. Tap the button to try again."); return; }
      if (r === "failed") { setError("The payment did not go through. Please try again."); return; }
      if (r !== "paid") {
        setInfo(r === "pending" ? "Payment is still being confirmed. Check Gifts you bought before trying again." : "This payment was returned or partly returned. No gift code is available from this payment. Contact the studio.");
        load(); return;
      }
      try { const c = await fetchGiftCode(g.giftId); if (c.expiresAt) setCard({ code: c.code, expiresAt: c.expiresAt }); }
      catch { setInfo("Payment received. Your gift is under Gifts you bought. Tap it to see the code."); }
      load();
    } catch (e) { setError(msg(e, "Could not start the payment. Please try again.")); }
    finally { buyBusy.current = false; setBusy(false); }
  }
  async function open(g: GiftView) {
    setBusy(true); setError(null); setInfo(null);
    try { const c = await fetchGiftCode(g.id); if (c.expiresAt) setCard({ code: c.code, expiresAt: c.expiresAt }); }
    catch (e) { setError(msg(e, "Could not open this gift.")); }
    finally { setBusy(false); }
  }
  async function redeem() {
    const c = normaliseGiftCode(code);
    if (!c) { setError("That does not look like a gift code. It starts with GW."); return; }
    setBusy(true); setError(null); setInfo(null);
    try { const g = await claimGift(c); setClaimed(g); setPendingGiftCode(c); setCode(""); }
    catch (e) { setError(msg(e, "That code did not work. Check it and try again.")); }
    finally { setBusy(false); }
  }
  const now = Date.now();
  return (
    <Screen appBar="Friends & gifts">
      {friendPanel}
      {card ? <GiftCard code={card.code} expiresAt={card.expiresAt} buyerName={buyerName} /> : null}
      {loadFailed ? <Notice title="Could not load gifts" body="Check your connection and try again." action={<Button icon="refresh" label="Retry" onPress={load} />} /> : null}
      {offer ? <GiftBuy amountPaise={offer.amountPaise} canPay={checkoutSupported || NATIVE_GIFT_PAYMENT_ENABLED} busy={busy} onPay={() => void buy()} /> : null}
      <Pane pad="gap">
        <T role="heading">Got a gift code?</T>
        <Field label="Gift code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="GW-XXXX-XXXX" maxLength={14} {...(error ? { error } : {})} />
        <Button label="Use this code" onPress={() => void redeem()} disabled={busy || code.trim() === ""} />
      </Pane>
      {info ? <T role="caption" tone="secondary">{info}</T> : null}
      {claimed?.expiresAt ? (
        <Notice title="Your gift is ready" body={`${GIFT_TERMS.oneWash} ${giftValidityLine(claimed.expiresAt, now)}`} action={<Button label="Book your wash" onPress={() => router.push(GIFT_SERVICE_ROUTE as never)} />} />
      ) : null}
      {gifts.length > 0 ? (
        <>
          <Kicker>Gifts you bought</Kicker>
          <Pane pad="gap">
            {gifts.map((g, i) => {
              const left = g.expiresAt ? giftDaysLeft(g.expiresAt, now) : 0;
              const detail = g.state === "unused" && g.expiresAt ? `${GIFT_STATE_LABEL.unused} - until ${day(g.expiresAt)} (${left} ${left === 1 ? "day" : "days"} left)` : GIFT_STATE_LABEL[g.state];
              return <Row key={g.id} title={`Gift ending ${g.tail}`} detail={detail} last={i === gifts.length - 1} {...(g.state === "unused" ? { onPress: () => void open(g) } : {})} />;
            })}
          </Pane>
          {gifts.some((g) => g.state === "unused") ? <T role="caption">Tap an unused gift to see its code and share it.</T> : null}
        </>
      ) : null}
    </Screen>
  );
}
