// Dev-only: renders signed-in screens with static data so layouts can be checked
// without a Firebase session. Never reachable in production builds (see NavigationGuard).
import { Screen } from "../ui/kit";
import { useLocalSearchParams } from "expo-router";
import { HomeView } from "../ui/HomeView";

const noop = () => undefined;
export default function Preview() {
  const { chip } = useLocalSearchParams<{ chip?: string }>();
  if (!__DEV__) return null;
  return (
    <Screen>
      <HomeView
        initialChip={chip ?? null}
        greeting="Good evening, Meet" initial="M" unread={2} progress={55} stage="Work under way" membership={{ title: "6 washes", detail: "left, until 30 Nov" }} studio={{ address: "Sunbeam Complex, Old Sharda Mandir Rd, Ellisbridge, Ahmedabad 380006", hours: "Mon to Sat, 10 am to 9 pm. Sunday, 10 am to 7 pm", openText: "Open now, until 9 pm", open: true }} quick={[{ key: "c", label: "Call", icon: "call", onPress: noop }, { key: "w", label: "WhatsApp", icon: "whatsapp", onPress: noop }, { key: "d", label: "Directions", icon: "directions", onPress: noop }]} social={[{ key: "a", title: "WhatsApp", sub: "Our channel", icon: "channel", onPress: noop }, { key: "b", title: "Instagram", sub: "@autodeck.studio", icon: "instagram", onPress: noop }]} onAvatar={noop} onCareMap={noop} onBook={noop} onStudio={noop} onMembership={noop} onVisits={noop} onShare={noop}
        cars={[{ id: "1", title: "BMW M340i", plate: "MH 02 AB 1234" }, { id: "2", title: "Thar", plate: "MH 02 CD 4321" }]}
        services={[
          { id: "a", category: "ppf", name: "Full body PPF", price: "Quote on request", brand: "XPEL" }, { id: "f", category: "ppf", name: "Plus PPF", price: "Quote on request", brand: "Garware" }, { id: "g", category: "ppf", name: "Ultimate Plus", price: "Quote on request", brand: "XPEL" },
          { id: "b", category: "ceramic", name: "Ceramic coating", price: "Quote on request", brand: "Kovalent" },
          { id: "c", category: "washing", name: "Detailing wash", price: "\u20b91,500" },
          { id: "e", category: "inspection", name: "Health check", price: "\u20b9999" },
          { id: "d", category: "tinting", name: "Window tint", price: "\u20b94,500" },
        ]}
        reminders={[{ title: "Insurance", detail: "Expires 3 Nov", chip: "22 days", danger: false }]}
        live={{ kicker: "Live now", title: "Work under way", detail: "Since 10:00 am", onPress: noop }}
        onSearch={noop} onBell={noop} onAllServices={noop} onCategory={noop} onService={noop} onCar={noop} onAddCar={noop} onReminders={noop}
      />
    </Screen>
  );
}
