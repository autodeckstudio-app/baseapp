import { useState } from "react";
import { Text, View, Pressable, Image, TextInput } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { quoteCart } from "@autodeck/core";
import { SHOP_FIXTURE } from "@autodeck/core/shop-fixture";
import { Screen } from "../ui/kit";
// Dev-only mock of the guest Shop screen. FIXTURE data from core, priced by the shared quoteCart. No payment.
const inr = (p: number) => "Rs " + (p / 100).toFixed(2);
export default function PreviewShop() {
  const { colors: ink } = useExperienceTheme();
  const [variantId, setVariantId] = useState("m");
  const [qty, setQty] = useState(2);
  const [guestOpen, setGuestOpen] = useState(false);
  const [g, setG] = useState({ name: "", mobile: "", address: "", city: "", state: "", pincode: "" });
  const [msg, setMsg] = useState("");
  if (!__DEV__) return null;
  const p = SHOP_FIXTURE.products[0]!;
  const q = quoteCart(SHOP_FIXTURE, [{ productId: p.id, variantId, quantity: qty }]);
  const chip = (on: boolean, off: boolean) => ({ minWidth: 48, height: 44, borderRadius: 12, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: 1, borderColor: on ? ink.textPrimary : ink.borderStrong, backgroundColor: on ? ink.textPrimary : "transparent", opacity: off ? 0.35 : 1 });
  return (
    <Screen>
      <View style={{ gap: 14 }}>
        <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: ink.borderStrong, paddingHorizontal: 12, paddingVertical: 6 }}><Text style={{ color: ink.textSecondary, fontSize: 11, letterSpacing: 1 }}>FIXTURE. NOT A PRODUCT. NO PAYMENT.</Text></View>
        <Image source={require("../../assets/dev/shop-fixture.jpg")} style={{ width: "100%", height: 220, borderRadius: 24, backgroundColor: ink.surface }} resizeMode="cover" />
        <Text style={{ color: ink.textPrimary, fontSize: 24, fontWeight: "700" }}>{p.name}</Text>
        <Text style={{ color: ink.textPrimary, fontSize: 22, fontWeight: "700" }}>{inr(p.pricePaise ?? 0)} <Text style={{ fontSize: 12, fontWeight: "400", color: ink.textTertiary }}>test value</Text></Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {p.variants.map((v) => { const off = v.stock === 0; const on = v.id === variantId; return (
            <Pressable key={v.id} disabled={off} onPress={() => setVariantId(v.id)} style={chip(on, off)}><Text style={{ color: on ? ink.canvas : ink.textPrimary, fontWeight: "600" }}>{v.label}</Text></Pressable>); })}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <Pressable onPress={() => setQty(Math.max(1, qty - 1))} style={chip(false, false)}><Text style={{ color: ink.textPrimary, fontSize: 20 }}>-</Text></Pressable>
          <Text style={{ color: ink.textPrimary, fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" }}>{qty}</Text>
          <Pressable onPress={() => setQty(Math.min(10, qty + 1))} style={chip(false, false)}><Text style={{ color: ink.textPrimary, fontSize: 20 }}>+</Text></Pressable>
        </View>
        {q.ok && (
          <View style={{ borderRadius: 24, backgroundColor: ink.surface, padding: 16, gap: 8 }}>
            <Row a={`${qty} x Size ${variantId.toUpperCase()}`} b={inr(q.subtotalPaise)} c={ink} />
            <Row a="Delivery (fixture value)" b={inr(q.deliveryPaise)} c={ink} />
            <Row a="Total" b={inr(q.totalPaise)} c={ink} bold />
          </View>
        )}
        {!guestOpen ? (
          <Pressable accessibilityRole="button" onPress={() => setGuestOpen(true)} style={{ height: 52, borderRadius: 999, backgroundColor: ink.textPrimary, alignItems: "center", justifyContent: "center" }}><Text style={{ color: ink.canvas, fontWeight: "700" }}>Continue as guest (test)</Text></Pressable>
        ) : (
          <View style={{ gap: 10 }}>
            {([["name", "Full name"], ["mobile", "Mobile"], ["address", "Address"], ["city", "City"], ["state", "State"], ["pincode", "Pincode"]] as const).map(([k, label]) => (
              <TextInput key={k} placeholder={label} placeholderTextColor={ink.textTertiary} value={g[k]} onChangeText={(v) => setG({ ...g, [k]: v })} style={{ height: 48, borderRadius: 12, borderWidth: 1, borderColor: ink.borderStrong, paddingHorizontal: 14, color: ink.textPrimary }} />
            ))}
            <Pressable accessibilityRole="button" onPress={async () => { try { const resp = await fetch("http://127.0.0.1:8796/order", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: [{ productId: p.id, variantId, quantity: qty }], guest: { ...g, clientKey: "preview-key-0123456789" } }) }); const r = await resp.json(); setMsg(r.ok ? `Test order accepted by the dev order server${r.replay ? " (same order, replay)" : ""}. Total ${inr(r.totalPaise)}. No payment taken.` : `Cannot place order: ${r.code}${r.detail ? " (" + r.detail + ")" : ""}`); } catch { setMsg("Dev order server not running (node scripts/shop-dev-order-server.mjs in apps/site). Nothing sent."); } }} style={{ height: 52, borderRadius: 999, backgroundColor: ink.textPrimary, alignItems: "center", justifyContent: "center" }}><Text style={{ color: ink.canvas, fontWeight: "700" }}>Place test order</Text></Pressable>
            {msg ? <Text style={{ color: ink.textPrimary, fontWeight: "600" }}>{msg}</Text> : null}
          </View>
        )}
      </View>
    </Screen>
  );
}
function Row({ a, b, c, bold }: { a: string; b: string; c: { textPrimary: string }; bold?: boolean }) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: c.textPrimary, fontWeight: bold ? "700" : "400" }}>{a}</Text><Text style={{ color: c.textPrimary, fontWeight: bold ? "700" : "400" }}>{b}</Text></View>;
}
