import { useEffect } from "react";
import { useRouter, useSegments } from "expo-router";
import { useAuth } from "../hooks/useAuth";
import { captureAuthReturn, consumeAuthReturn } from "../lib/auth-return";
// Any signed-in account may use the customer app. Staff access stays additive.
export function NavigationGuard({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (auth.status === "loading") return;
    const segs = segments as string[];
    const group = segs[0];
    const inAuth = group === "(auth)";
    if (
      __DEV__ &&
      (group === "preview" ||
        group === "preview-services" ||
        group === "preview-car" ||
        group === "preview-profile" ||
        group === "preview-bookings" ||
        group === "preview-booking" ||
        group === "preview-help" ||
        group === "preview-combos" ||
        group === "preview-garage" ||
        group === "preview-cars" ||
        group === "preview-membership" ||
        group === "preview-kit" ||
        group === "preview-price" ||
        group === "preview-service" ||
        group === "preview-studio" ||
        group === "preview-detail" ||
        group === "preview-catalogue" ||
        group === "preview-gifts" ||
        group === "preview-stories" ||
        group === "preview-shop")
    )
      return;

    if (auth.status === "unauthenticated") {
      const browsingCars =
        (group === "(tabs)" && segs[1] === "cars" && segs[2] !== "sell") ||
        group === "shop";
      // Dev preview only: ?mock=1 renders the GARAGE sample screens without a session
      // (__DEV__ stripped in prod). The bypass is deliberately narrow: navigating away
      // (Book a service, history, tabs) hits the normal signed-out gate, so a sample
      // preview can never escape into a live booking or other real screen.
      const devMockPreview =
        __DEV__ &&
        (segs[1] === "garage" || segs[1] === "bookings") &&
        /[?&]mock=/.test(
          (globalThis as { window?: { location?: { search?: string } } }).window
            ?.location?.search ?? "",
        );
      if (
        !devMockPreview &&
        !browsingCars &&
        (!inAuth || (segs[1] !== "login" && segs[1] !== "welcome"))
      ) {
        // Remember where this signed-out visitor was heading (web deep link,
        // e.g. a website service CTA) so sign-in can return them there.
        const loc = (
          globalThis as {
            window?: { location?: { pathname: string; search: string } };
          }
        ).window?.location;
        if (loc) captureAuthReturn(loc.pathname + loc.search);
        router.replace("/(auth)/login");
      }
    } else if (auth.status === "authenticated_no_claims") {
      if (!inAuth || (segs[1] !== "setup" && segs[1] !== "claim"))
        router.replace("/(auth)/setup");
    } else if (inAuth) {
      router.replace(consumeAuthReturn() ?? "/(tabs)");
    }
  }, [auth, segments, router]);

  return <>{children}</>;
}
