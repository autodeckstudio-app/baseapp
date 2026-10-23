import { useState } from "react";
import { Text, View, Pressable, ScrollView } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { SHOP_CONCEPTS, type ShopConcept } from "@autodeck/core";
import { Screen } from "../ui/kit";
// Dev-only fixture shop: required only under __DEV__ so production bundles never contain it (see metro.config.js and scripts/prod-bundle-guard.mjs).
const PreviewShop = __DEV__ ? (require("./preview-shop") as typeof import("./preview-shop")).default : null;

// Guest Shop route. The store is not open: concepts are browse-only, carry no
// prices, and nothing can be ordered. The owner supplies final names, prints,
// imagery and prices later; merch name/image pairing is an open decision.
const DEPARTMENTS = ["All", "Scent", "Clothing", "Car accessories"] as const;

export default function Shop() {
  const { colors: ink } = useExperienceTheme();
  const [dept, setDept] = useState<(typeof DEPARTMENTS)[number]>("All");
  const [open, setOpen] = useState<ShopConcept | null>(null);
  if (__DEV__ && PreviewShop) return <PreviewShop />;

  // Limited drops surface only under "All"; other concepts under their department.
  const shown = SHOP_CONCEPTS.filter((c) => !c.limited && (dept === "All" || c.department === dept));
  const limited = dept === "All" ? SHOP_CONCEPTS.filter((c) => c.limited) : [];

  const chip = (on: boolean) => ({
    paddingHorizontal: 16, height: 40, borderRadius: 999, borderWidth: 1,
    borderColor: on ? ink.textPrimary : ink.borderStrong,
    backgroundColor: on ? ink.textPrimary : "transparent",
    alignItems: "center" as const, justifyContent: "center" as const,
  });

  if (open) {
    return (
      <Screen>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
          <Pressable accessibilityRole="button" onPress={() => setOpen(null)}><Text style={{ color: ink.textSecondary }}>Back to the store</Text></Pressable>
          <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: ink.borderStrong, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: ink.textSecondary, fontSize: 11, letterSpacing: 1 }}>CONCEPT{open.limited ? " · LIMITED DROP" : ""}</Text>
          </View>
          <Text style={{ color: ink.textPrimary, fontSize: 24, fontWeight: "700" }}>{open.name}</Text>
          <Text style={{ color: ink.textSecondary }}>{open.department}{open.label ? ` · ${open.label}` : ""}</Text>
          <Text style={{ color: ink.textSecondary }}>{open.blurb}</Text>
          <Text style={{ color: ink.textSecondary }}>No price yet.</Text>
          <View style={{ height: 52, borderRadius: 999, backgroundColor: ink.surface, alignItems: "center", justifyContent: "center", opacity: 0.5 }}>
            <Text style={{ color: ink.textTertiary, fontWeight: "700" }}>Not available to order yet</Text>
          </View>
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
        <Text style={{ color: ink.textPrimary, fontSize: 22, fontWeight: "700" }}>Shop</Text>
        <Text style={{ color: ink.textSecondary }}>The AutoDeck store is taking shape. Everything here is a concept — ordering is not open yet.</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {DEPARTMENTS.map((d) => (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: dept === d }} onPress={() => setDept(d)} style={chip(dept === d)}>
              <Text style={{ color: dept === d ? ink.canvas : ink.textPrimary, fontWeight: "600" }}>{d}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {[...shown, ...limited].map((c) => (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => setOpen(c)} style={{ width: "47%", borderRadius: 24, backgroundColor: ink.surface, padding: 14, gap: 6 }}>
              <View style={{ alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: ink.borderStrong, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: ink.textTertiary, fontSize: 10, letterSpacing: 1 }}>CONCEPT</Text>
              </View>
              <Text style={{ color: ink.textPrimary, fontWeight: "700" }}>{c.name}</Text>
              <Text style={{ color: ink.textTertiary, fontSize: 12 }}>{c.label ?? c.department}{c.limited ? " · Limited" : ""}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
