import { Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { Screen } from "../ui/kit";
// Dev-only fixture shop: required only under __DEV__ so production bundles never contain it (see metro.config.js and scripts/prod-bundle-guard.mjs).
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- dev-only require, type-only import() is intentional
const PreviewShop = __DEV__ ? (require("./preview-shop") as typeof import("./preview-shop")).default : null;

// Guest Shop route. No catalogue source exists yet (the owner supplies products last), so production
// shows "not open yet" and takes no orders. The fixture shop renders only in a dev build.
export default function Shop() {
  const { colors: ink } = useExperienceTheme();
  if (__DEV__ && PreviewShop) return <PreviewShop />;
  return (
    <Screen>
      <View style={{ padding: 24, gap: 8 }}>
        <Text style={{ color: ink.textPrimary, fontSize: 22, fontWeight: "700" }}>Shop</Text>
        <Text style={{ color: ink.textSecondary }}>Ordering is not open yet.</Text>
      </View>
    </Screen>
  );
}
