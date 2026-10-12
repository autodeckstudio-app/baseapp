// Dev-only mock of the Care map.
import { View } from "react-native";
import { Screen } from "../ui/kit";
import { CareMap } from "../ui/CareMap";

export default function PreviewCare() {
  if (!__DEV__) return null;
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <CareMap done={{ ppf: null, coating: "2026-08-14T10:00:00Z", tint: "2026-09-02T10:00:00Z" }} onBook={() => undefined} />
      </View>
    </Screen>
  );
}
