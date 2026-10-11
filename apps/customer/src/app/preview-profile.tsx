// Dev-only mock of the You tab head.
import { Screen } from "../ui/kit";
import { ProfileHero } from "../ui/ProfileHero";

const noop = () => undefined;
export default function PreviewProfile() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <ProfileHero name="Meet Sheth" email="meet@example.com" onEdit={noop} tiles={[{ icon: "club", label: "Membership", onPress: noop }, { icon: "bell", label: "Notifications", onPress: noop }, { icon: "garage", label: "My cars", onPress: noop }, { icon: "users", label: "Help and contact", onPress: noop }]} />
    </Screen>
  );
}
