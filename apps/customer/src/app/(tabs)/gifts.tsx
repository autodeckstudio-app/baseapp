import { SelectField } from "../../ui/inputs";
import { StatePanel } from "../../ui/StatePanel";
// Gifts: buy a foam wash for someone (pay, then get the code to share), enter a code you were given, and see the gifts you bought.
// Empty until GIFT_LIVE. A gift is valid 60 days from payment and cannot be refunded; both are said before the pay button.
import { useCallback, useEffect, useRef, useState } from "react";
import { Share, View } from "react-native";
import { useRouter } from "expo-router";
import { space } from "@autodeck/ui/theme";
import { GIFT_TERMS, giftDaysLeft, giftValidityLine, normaliseGiftCode } from "@autodeck/core";
import { Button, Field, Kicker, Notice, PageHeader, Pane, Row, Screen, T, rupees } from "../../ui/kit";
import { giftCodeProblem } from '../../lib/gift-code-feedback';
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
  const owner=auth.status==="ready"?`${auth.claims.tenantId}:${auth.user.uid}`:null;
  const ownerRef=useRef(owner);const ownerEpoch=useRef(0);if(ownerRef.current!==owner){ownerEpoch.current+=1;ownerRef.current=owner;}
  const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
  const buyerName = auth.status === "ready" ? auth.user.displayName ?? null : null;
  const [stateOwner,setStateOwner]=useState(owner);
  const visible=stateOwner===owner;
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [giftAction,setGiftAction]=useState<"buy"|"open"|"redeem"|null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<GiftView | null>(null);
  const [gifts, setGifts] = useState<GiftView[]>([]);
  const [offers,setOffers]=useState<GiftOffer[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [legacyOffer, setOffer] = useState<GiftOffer | null>(null);
  const [card, setCard] = useState<{ code: string; expiresAt: string;serviceName?:string|undefined } | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loading,setLoading]=useState(true);
  const loadGeneration=useRef(0);
  const buyBusy = useRef(false);
  const load = useCallback(() => {
    const generation=++loadGeneration.current;const loadOwner=owner;const epoch=ownerEpoch.current;
    setLoadFailed(false);setLoading(true);
    void listMyGifts().then((r) => { if(generation!==loadGeneration.current||ownerRef.current!==loadOwner||ownerEpoch.current!==epoch||!mounted.current)return;setGifts(r.gifts); setOffer(r.offer);setOffers(r.offers??[]);setSelectedId(id=>(r.offers??[]).some(o=>o.serviceId===id)?id:""); }).catch(() => {if(generation===loadGeneration.current&&ownerRef.current===loadOwner&&ownerEpoch.current===epoch&&mounted.current)setLoadFailed(true)}).finally(()=>{if(generation===loadGeneration.current&&ownerRef.current===loadOwner&&ownerEpoch.current===epoch&&mounted.current)setLoading(false)});
  }, [owner]);
  useEffect(() => {setStateOwner(owner);setGifts([]);setOffer(null);setOffers([]);setSelectedId("");setClaimed(null);setCard(null);setCode("");setInfo(null);setError(null);setBusy(false);setGiftAction(null);if (GIFT_LIVE&&owner) load(); return()=>{loadGeneration.current+=1}; }, [load,owner]);
  const referralCode = auth.status === "ready" ? referralCodeFor(auth.user.uid) : null;
  const friendPanel = <Pane pad="inset"><View style={{gap:16}}><View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12}}><T role="heading" style={{flex:1}}>Share AutoDeck</T><Button icon="share" label="Share AutoDeck" onPress={() => void Share.share({ message: referralShareMessage(referralCode) }).catch(() => undefined)} /></View>{referralSubtitle(referralCode)!=="Share AutoDeck"?<T tone="secondary">{referralSubtitle(referralCode)}</T>:null}</View></Pane>;
  if (!GIFT_LIVE) return <Screen appBar="Friends & gifts" header={<PageHeader title="Friends & gifts" />}>{friendPanel}<StatePanel compact icon="gift" title="Gift a wash" body="Wash gifting is not available yet." /></Screen>;

  const offer=offers.find(o=>o.serviceId===selectedId)??(offers.length?null:legacyOffer);
  async function buy() {
    if(!offer||busy)return;
    if (!checkoutSupported && !NATIVE_GIFT_PAYMENT_ENABLED) { setInfo("Buying a gift is not available in this app build yet. Use app.autodeck.in."); return; }
    if (buyBusy.current) return; // double-tap: one in-flight purchase; the server slot is the second line
    buyBusy.current = true;
    const buyOwner=owner;const buyEpoch=ownerEpoch.current;
    setGiftAction("buy");setBusy(true); setError(null); setInfo(null); setCard(null);
    try {
      const g = await startGiftPurchase(offer.serviceId);if((ownerRef.current!==buyOwner||ownerEpoch.current!==buyEpoch||!mounted.current))return;
      if(offer.serviceId&&g.serviceId!==offer.serviceId){setError("The selected gift service was not confirmed. Refresh before paying.");load();return;}
      if(g.amountPaise!==offer.amountPaise){setInfo("The service price changed. Review the updated price before paying.");load();return;}
      const link = checkoutSupported ? null : await requestGiftPaymentLink(g.paymentId);if((ownerRef.current!==buyOwner||ownerEpoch.current!==buyEpoch||!mounted.current))return;
      if (link && !link.paymentUrl) { setInfo("Your earlier payment is being checked. Contact the studio before trying again."); load(); return; }
      const r = await payOnline({ paymentId: g.paymentId, paymentUrl: link?.paymentUrl ?? null, name: "AutoDeck Studio", description: `Gift: ${g.serviceName??offer.serviceName??"Foam wash"}` });
      if((ownerRef.current!==buyOwner||ownerEpoch.current!==buyEpoch||!mounted.current))return;
      if (r === "dismissed") { setInfo("The payment was not completed. Tap the button to try again."); return; }
      if (r === "failed") { setError("The payment did not go through. Please try again."); return; }
      if (r !== "paid") {
        setInfo(r === "pending" ? "Payment is still being confirmed. Check Gifts you bought before trying again." : "This payment was returned or partly returned. No gift code is available from this payment. Contact the studio.");
        load(); return;
      }
      try { const c = await fetchGiftCode(g.giftId); if ((ownerRef.current===buyOwner&&ownerEpoch.current===buyEpoch&&mounted.current)&&c.expiresAt) setCard({ code: c.code, expiresAt: c.expiresAt,serviceName:c.serviceName }); }
      catch { if((ownerRef.current!==buyOwner||ownerEpoch.current!==buyEpoch||!mounted.current))return;setInfo("Payment received. Your gift is under Gifts you bought. Tap it to see the code."); }
      if((ownerRef.current===buyOwner&&ownerEpoch.current===buyEpoch&&mounted.current))load();
    } catch (e) {if((ownerRef.current!==buyOwner||ownerEpoch.current!==buyEpoch||!mounted.current))return;setError(msg(e, "Could not start the payment. Please try again.")); }
    finally { buyBusy.current = false;if((ownerRef.current===buyOwner&&ownerEpoch.current===buyEpoch&&mounted.current)){setBusy(false);setGiftAction(null);} }
  }
  async function open(g: GiftView) {
    if(busy)return;
    const openOwner=owner;const openEpoch=ownerEpoch.current;
    setGiftAction("open");setBusy(true); setError(null); setInfo(null);
    try { const c = await fetchGiftCode(g.id); if ((ownerRef.current===openOwner&&ownerEpoch.current===openEpoch&&mounted.current)&&c.expiresAt) setCard({ code: c.code, expiresAt: c.expiresAt,serviceName:c.serviceName }); }
    catch (e) {if((ownerRef.current===openOwner&&ownerEpoch.current===openEpoch&&mounted.current))setError(msg(e, "Could not open this gift.")); }
    finally {if((ownerRef.current===openOwner&&ownerEpoch.current===openEpoch&&mounted.current)){setBusy(false);setGiftAction(null);} }
  }
  async function redeem() {
    if(busy)return;
    const c = normaliseGiftCode(code);
    if (!c) { setError(giftCodeProblem(code)); return; }
    setGiftAction("redeem");setBusy(true); setError(null); setInfo(null);
    const claimOwner=owner;const claimEpoch=ownerEpoch.current;
    try { const g = await claimGift(c);if((ownerRef.current!==claimOwner||ownerEpoch.current!==claimEpoch||!mounted.current))return;setClaimed(g); setPendingGiftCode(c,g.serviceId); setCode("");setInfo("Gift added");load(); }
    catch (e) {if((ownerRef.current===claimOwner&&ownerEpoch.current===claimEpoch&&mounted.current))setError(msg(e, "That code did not work. Check it and try again.")); }
    finally {if((ownerRef.current===claimOwner&&ownerEpoch.current===claimEpoch&&mounted.current)){setBusy(false);setGiftAction(null);} }
  }
  const now = Date.now();
  if(!visible)return <Screen appBar="Friends & gifts" header={<PageHeader title="Friends & gifts" />}><T role="caption" tone="secondary">Loading gifts</T></Screen>;
  return (
    <Screen appBar="Friends & gifts" header={<PageHeader title="Friends & gifts" />}>
      {friendPanel}
      {card ? <GiftCard code={card.code} expiresAt={card.expiresAt} buyerName={buyerName} serviceName={card.serviceName} /> : null}
      {loadFailed ? <Notice title="Could not load gifts" body="Check your connection and try again." action={<Button icon="refresh" label="Retry" onPress={load} />} /> : null}
      {loading?<T role="caption" tone="secondary">Loading gifts</T>:null}
      {!loading&&!loadFailed&&gifts.length===0?<StatePanel compact icon="gift" title="No gifts bought yet" body="You can add a code below, or buy a gift when available."/>:null}
      {offers.length?<Pane pad="inset"><View style={{gap:16}}><T role="heading">Choose a service to gift</T><SelectField label="Gift service" value={selectedId} onChange={setSelectedId} options={[{value:"",label:"Choose washing or detailing"},...offers.map(o=>({value:o.serviceId!,label:`${o.serviceName} · ${rupees(o.amountPaise)}`}))]}/></View></Pane>:null}
      {offer ? <GiftBuy serviceName={offer.serviceName} amountPaise={offer.amountPaise} canPay={checkoutSupported || NATIVE_GIFT_PAYMENT_ENABLED} busy={busy&&giftAction==="buy"} disabled={busy} onPay={() => void buy()} /> : null}
      <Pane pad="inset"><View style={{gap:16}}>
        <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:8}}>
          <T role="heading" style={{fontSize:14,lineHeight:20,flexShrink:1}}>Got a gift code?</T>
          <Button style={{marginTop:0,marginBottom:0,paddingHorizontal:8,flexShrink:0}} label="Use this code" busy={busy&&giftAction==="redeem"} onPress={() => void redeem()} disabled={busy || code.trim() === ""} />
        </View>
        <Field label="Gift code" value={code} onChangeText={setCode} autoCapitalize="characters" placeholder="GW-XXXX-XXXX" maxLength={14} {...(error ? { error } : {})} />
      </View></Pane>
      {info ? <T role="caption" tone="secondary">{info}</T> : null}
      {claimed?.expiresAt ? (
        <Notice title="Your gift is ready" body={`${claimed.serviceName??"Foam wash"}. Any car, one use. ${giftValidityLine(claimed.expiresAt, now)}`} action={<Button label="Book your service" onPress={() => router.push((claimed.serviceId?`/(tabs)/book/${encodeURIComponent(claimed.serviceId)}`:GIFT_SERVICE_ROUTE) as never)} />} />
      ) : null}
      {gifts.length > 0 ? (
        <>
          <Kicker>Gifts you bought</Kicker>
          <Pane pad="gap">
            {gifts.map((g, i) => {
              const left = g.expiresAt ? giftDaysLeft(g.expiresAt, now) : 0;
              const detail = g.state === "unused" && g.expiresAt ? `${GIFT_STATE_LABEL.unused} - until ${day(g.expiresAt)} (${left} ${left === 1 ? "day" : "days"} left)` : GIFT_STATE_LABEL[g.state];
              return <Row key={g.id} title={`${g.serviceName??"Gift"} ending ${g.tail}`} detail={detail} last={i === gifts.length - 1} {...(g.state === "unused" ? { onPress: () => void open(g) } : {})} />;
            })}
          </Pane>
          {gifts.some((g) => g.state === "unused") ? <T role="caption">Tap an unused gift to see its code and share it.</T> : null}
        </>
      ) : null}
    </Screen>
  );
}
