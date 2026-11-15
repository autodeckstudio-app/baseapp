// Combos on the Bookings page: every active, fixed-price package the catalogue lists, with its own description. Nothing is invented.
// Cards are fully tappable into the real booking flow; a subtle chevron marks that instead of a repeated Book button on every card (Gauri batch item 2).
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import type { Service } from "@autodeck/core";
import { comboCards } from "../lib/booking-ideas";
import { ServicePhoto } from "./ServicePhoto";
import { VisitCard } from "./VisitCard";
import { SectionTitle, T } from "./kit";

export function CombosSection({ catalogue, onBook }: { catalogue: Service[]; onBook: (serviceId: string) => void }) {
  const combos = comboCards(catalogue);
  if (!combos.length) return null;
  return (
    <View style={{ gap: space.line }}>
      <SectionTitle>Combos</SectionTitle>
      {combos.map((c) => (
        <VisitCard key={c.service.id} onPress={() => onBook(c.service.id)} photo={<ServicePhoto service={c.service} height={64} />} title={c.service.name} car={c.parts.join(" + ")} when="" price="" trailing={<T role="title" tone="tertiary" style={{ alignSelf: "center" }}>{"\u203A"}</T>} />
      ))}
    </View>
  );
}
