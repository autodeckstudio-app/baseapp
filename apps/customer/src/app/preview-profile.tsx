// Dev-only mock of the You tab head.
import { Screen } from "../ui/kit";
import { ProfileHero } from "../ui/ProfileHero";

const noop = () => undefined;
export default function PreviewProfile() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <ProfileHero name="Meet Sheth" email="meet@example.com" onEdit={noop} />
    </Screen>
  );
}
