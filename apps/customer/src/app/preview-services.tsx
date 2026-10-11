// Dev-only mock of the Services landing, same components as the real screen.
import { Text, View } from "react-native";
import { Icon } from "@autodeck/ui/native";
import { Screen } from "../ui/kit";
import { PhotoCard, GroupChips } from "../ui/HomeView";
import { serviceImagery } from "../lib/imagery";
import { Image } from "react-native";

const items = [["Washing", "washing", "From \u20b91,500"], ["Ceramic", "ceramic", "Quote"], ["Paint film", "ppf", "Quote"], ["Coatings", "coating", "From \u20b94,000"], ["Window film", "tinting", "From \u20b94,500"], ["Inspection", "inspection", "From \u20b9999"]] as const;
export default function PreviewServices() {
  if (!__DEV__) return null;
  const nodes = items.map(([t, c, p]) => <PhotoCard key={t} title={t} pill={p} hearted={false} onPress={() => undefined} media={<Image source={(serviceImagery as never)[c]} resizeMode="cover" style={{ width: "100%", height: "100%" }} />} />);
  const rows = [0, 2, 4].map((i) => <View key={i} style={{ flexDirection: "row", gap: 12 }}>{nodes.slice(i, i + 2)}</View>);
  return (
    <Screen>
      <View style={{ gap: 16 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "700" }}>Services</Text>
        <View style={{ height: 48, borderRadius: 24, backgroundColor: "#26262A", flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16 }}>
          <Icon name="search" color="#8C8A86" size={20} /><Text style={{ color: "#8C8A86", fontSize: 15 }}>Search services</Text>
        </View>
        <GroupChips value={null} onChange={() => undefined} />
        <View style={{ gap: 12 }}>{rows}</View>
      </View>
    </Screen>
  );
}
