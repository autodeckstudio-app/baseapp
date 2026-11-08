import { useExperienceTheme } from "@autodeck/ui/native";
// Dev-only mock of the Visits list.
import { Image, Text, View } from "react-native";
import { Screen, Chip } from "../ui/kit";
import { VisitCard } from "../ui/VisitCard";
import { NextVisitHero } from "../ui/NextVisitHero";
import { vehicleImagery, serviceImagery } from "../lib/imagery";

const noop = () => undefined;
// Fixture dates are computed from today so the sample never goes stale or contradicts itself.
const day = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return d; };
const iso = (d: Date) => d.toISOString().slice(0, 10);
const short = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const photo = (src: never) => <Image source={src} resizeMode="cover" style={{ width: 92, height: 92 }} />;
export default function PreviewBookings() {
  const { colors: ink } = useExperienceTheme();
  if (!__DEV__) return null;
  return (
    <Screen header={<Text style={{ color: ink.textPrimary, fontSize: 26, fontWeight: "700" }}>Visits</Text>}>
      <View style={{ gap: 12 }}>
        <NextVisitHero date={iso(day(3))} today={iso(day(0))} time="10:00" title="Full body PPF" car="BMW M340i" status="Confirmed" onPress={noop} />
        <Text style={{ color: ink.textPrimary, fontSize: 19, fontWeight: "700" }}>Coming up</Text>
        <VisitCard onPress={noop} photo={photo(vehicleImagery.sedan! as never)} title="Full body PPF" car="BMW M340i" when={`${short(day(7))} \u00b7 10:00`} price={"\u20b91,20,000"} chip={<Chip label="Confirmed" tone="premium" />} />
        <VisitCard onPress={noop} photo={photo(serviceImagery.washing as never)} title="Detailing wash" car="Thar" when={`${short(day(11))} \u00b7 15:30`} price={"\u20b91,500"} chip={<Chip label="Awaiting confirm" tone="accent" />} />
        <Text style={{ color: ink.textPrimary, fontSize: 19, fontWeight: "700", marginTop: 8 }}>Combos</Text>
        <VisitCard onPress={noop} photo={photo(serviceImagery.washing as never)} title="Full detail wash" car="Exterior wash + Interior deep clean" when="" price="" chip={<Chip label="Book" tone="accent" />} />
        <Text style={{ color: ink.textPrimary, fontSize: 19, fontWeight: "700", marginTop: 8 }}>History</Text>
        <VisitCard onPress={noop} photo={photo(serviceImagery.tinting as never)} title="Window tint" car="BMW M340i" when={`${short(day(-66))} \u00b7 11:00`} price={"\u20b94,500"} chip={<Chip label="Done" tone="neutral" />} />
      </View>
    </Screen>
  );
}
