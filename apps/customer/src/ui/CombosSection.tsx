// Combos on the Bookings page: every active, fixed-price package the catalogue lists, with its own description. Nothing is invented.
import { View } from "react-native";
import { space } from "@autodeck/ui/theme";
import type { Service } from "@autodeck/core";
import { comboCards } from "../lib/booking-ideas";
import { ServicePhoto } from "./ServicePhoto";
import { VisitCard } from "./VisitCard";
import { Chip, SectionTitle } from "./kit";

export function CombosSection({ catalogue, onBook }: { catalogue: Service[]; onBook: (serviceId: string) => void }) {
  const combos = comboCards(catalogue);
  if (!combos.length) return null;
  return (
    <View style={{ gap: space.line }}>
      <SectionTitle>Combos</SectionTitle>
      {combos.map((c) => (
        <VisitCard key={c.service.id} onPress={() => onBook(c.service.id)} photo={<ServicePhoto service={c.service} height={64} />} title={c.service.name} car={c.parts.join(" + ")} when="" price="" chip={<Chip label="Book" tone="accent" />} />
      ))}
    </View>
  );
}
