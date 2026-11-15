import { useRouter } from "expo-router";
import { Onboarding } from "../../ui/Onboarding";

export default function Welcome() {
  const router = useRouter();
  return <Onboarding onDone={() => router.replace("/(auth)/login")} />;
}
