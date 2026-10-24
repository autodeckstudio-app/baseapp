import { useState } from "react";
import { View, Pressable } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { SHOP_CONCEPTS, type ShopConcept } from "@autodeck/core";
import type PreviewShopComponent from "./preview-shop";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, PageHeader, Pane, Screen, T } from "../ui/kit";
// Dev-only fixture shop: required only under __DEV__ so production bundles never contain it (see metro.config.js and scripts/prod-bundle-guard.mjs).
const PreviewShop = __DEV__ ? (require("./preview-shop") as { default: typeof PreviewShopComponent }).default : null;

// Guest Shop route. The store is not open: concepts are browse-only, carry no
// prices, and nothing can be ordered. The owner supplies final names, prints,
// imagery and prices later; merch name/image pairing is an open decision.
// Built on the shared kit (PageHeader, Pane, Chip, Button) and the catalogue
// filter-chip pattern so it reads like the rest of the app, not a one-off.
const DEPARTMENTS = ["All", "Scent", "Clothing", "Car accessories"] as const;

export default function Shop() {
  const { colors } = useExperienceTheme();
  const [dept, setDept] = useState<(typeof DEPARTMENTS)[number]>("All");
  const [open, setOpen] = useState<ShopConcept | null>(null);
  if (__DEV__ && PreviewShop) return <PreviewShop />;

  // Limited drops surface only under "All"; other concepts under their department chip.
  const shown = SHOP_CONCEPTS.filter((c) => !c.limited && (dept === "All" || c.department === dept));
  const limited = dept === "All" ? SHOP_CONCEPTS.filter((c) => c.limited) : [];

  const chips = (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.line }}>
      {DEPARTMENTS.map((d) => {
        const on = dept === d;
        return (
          <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setDept(d)} style={{ alignItems: "center", borderRadius: 9999, borderWidth: 1, borderColor: on ? colors.accent : colors.borderSubtle, backgroundColor: on ? colors.accentHaze : "transparent", paddingHorizontal: 14, paddingVertical: 8 }}>
            <T role="caption" tone={on ? "accent" : "secondary"}>{d}</T>
          </Pressable>
        );
      })}
    </View>
  );

  const tile = (c: ShopConcept) => (
    <Pressable key={c.id} accessibilityRole="button" onPress={() => setOpen(c)} style={{ flexBasis: "47%", flexGrow: 1 }}>
      <Pane>
        <View style={{ gap: space.line }}>
          <Chip label={c.limited ? "CONCEPT · LIMITED DROP" : "CONCEPT"} tone={c.limited ? "premium" : "neutral"} />
          <T role="heading">{c.name}</T>
          <T role="caption" tone="tertiary">{c.label ?? c.department}</T>
        </View>
      </Pane>
    </Pressable>
  );

  if (open) {
    return (
      <Screen appBar="Shop" onBack={() => setOpen(null)}>
        <View style={{ gap: space.line }}>
          <Chip label={open.limited ? "CONCEPT · LIMITED DROP" : "CONCEPT"} tone={open.limited ? "premium" : "neutral"} />
          <T role="title">{open.name}</T>
          <T role="body" tone="secondary">{open.label ?? open.department}</T>
          <T role="body" tone="secondary">{open.blurb}</T>
          <T role="body" tone="secondary">No price yet.</T>
          <Button label="Not available to order yet" disabled onPress={() => undefined} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen appBar="Shop">
      <PageHeader kicker="GUEST STORE" title="Everything here is a concept" sub="The AutoDeck store is taking shape. Ordering is not open yet." />
      {chips}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.gap }}>
        {[...shown, ...limited].map(tile)}
      </View>
    </Screen>
  );
}
