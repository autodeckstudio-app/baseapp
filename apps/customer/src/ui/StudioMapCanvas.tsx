import { Platform, Pressable, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
export function StudioMapCanvas({ onPress }: { onPress: () => void }) {
  const { name, colors } = useExperienceTheme();
  const night = name !== "light";
  const land = night ? "#16181C" : "#DDE1E6";
  const block = night ? "#1D2025" : "#E9ECEF";
  const road = night ? "#2A2D33" : "#F7F8FA";
  const park = night ? "#18241E" : "#D3E3D8";
  const label = night ? "#7C8088" : "#8A9099";
  const bar = (style: object) => <View style={{ position: "absolute", backgroundColor: road, borderRadius: 6, ...style }} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open the studio in maps" onPress={onPress} style={{ height: 230, borderRadius: 24, overflow: "hidden", backgroundColor: land }}>
      <View style={{ position: "absolute", left: 20, top: 150, width: 120, height: 90, borderRadius: 16, backgroundColor: park }} />
      {[[16, 24, 90, 60], [124, 24, 110, 60], [250, 24, 120, 60], [20, 260, 100, 70], [140, 262, 90, 70], [250, 160, 120, 80]].map(([l, t, w, h], i) => (
        <View key={i} style={{ position: "absolute", left: l!, top: t!, width: w!, height: h!, borderRadius: 12, backgroundColor: block }} />
      ))}
      {bar({ left: 0, right: 0, top: 104, height: 16 })}
      {bar({ left: 0, right: 0, top: 236, height: 12 })}
      {bar({ left: 112, top: 0, bottom: 0, width: 14 })}
      {bar({ left: 240, top: 0, bottom: 0, width: 14 })}
      <Text style={{ position: "absolute", left: 150, top: 108, color: label, fontSize: 10, fontWeight: "600" }}>Old Sharda Mandir Rd</Text>
      <View style={{ position: "absolute", left: 150, top: 150, alignItems: "center", gap: 4 }}>
        <View style={{ width: 54, height: 54, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: night ? "#B9A58C" : "#16181C", ...(Platform.OS === "web" ? ({ boxShadow: "0 12px 22px rgba(0,0,0,.35)" } as object) : {}) }}>
          <Icon name="garage" color={night ? "#16181C" : "#FFFFFF"} size={26} />
        </View>
        <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surface }}><Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}>AutoDeck</Text></View>
      </View>
    </Pressable>
  );
}

