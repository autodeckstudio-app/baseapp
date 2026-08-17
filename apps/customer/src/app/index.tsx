import { Redirect } from "expo-router";

// Root redirects to auth; auth flow determines whether to go to (tabs)
export default function Index() {
  return <Redirect href="/(auth)/login" />;
}
