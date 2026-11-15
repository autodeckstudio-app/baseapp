// The membership card lives on the hub only. This route stays so old links and notifications still land.
import { Redirect } from "expo-router";

export default function CurrentMembershipScreen() {
  return <Redirect href="/(tabs)/membership" />;
}
