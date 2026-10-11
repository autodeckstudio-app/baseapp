// Dev-only: renders signed-in screens with static data so layouts can be checked
// without a Firebase session. Never reachable in production builds (see NavigationGuard).
import { Screen } from "../ui/kit";
import { HomeView } from "../ui/HomeView";

const noop = () => undefined;
export default function Preview() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <HomeView
        greeting="Good evening, Meet" unread={2}
        cars={[{ id: "1", title: "BMW M340i", plate: "MH 02 AB 1234" }, { id: "2", title: "Thar", plate: "MH 02 CD 4321" }]}
        services={[
          { id: "a", category: "ppf", name: "Full body PPF", price: "Quote on request" },
          { id: "b", category: "ceramic", name: "Ceramic coating", price: "Quote on request" },
          { id: "c", category: "washing", name: "Detailing wash", price: "\u20b91,500" },
          { id: "e", category: "inspection", name: "Health check", price: "\u20b9999" },
          { id: "d", category: "tinting", name: "Window tint", price: "\u20b94,500" },
        ]}
        reminders={[{ title: "Insurance", detail: "Expires 3 Nov", chip: "22 days", danger: false }]}
        live={{ kicker: "Next visit", title: "14 Oct \u00b7 10:00", detail: "Confirmed", onPress: noop }}
        onSearch={noop} onBell={noop} onAllServices={noop} onCategory={noop} onService={noop} onCar={noop} onAddCar={noop} onReminders={noop}
      />
    </Screen>
  );
}
