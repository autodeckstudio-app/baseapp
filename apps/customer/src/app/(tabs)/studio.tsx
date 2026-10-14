// Studio: a stylised map of the studio's street with a bottom sheet (reference
// screen 2): address, hours, services to start from, call and directions.
import { useEffect, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { FIRST_STUDIO_ID } from "@autodeck/core";
import { raised } from "../../lib/raised";
import { STUDIO_INFO, formatHours } from "../../lib/studio-info";
import { getStudioInfo } from "../../lib/booking-service";
import { Screen } from "../../ui/kit";

const ROWS: Array<{ cat: string; title: string; note: string }> = [
  { cat: "washing", title: "Wash and care", note: "Detailing washes and care plans" },
  { cat: "coating", title: "Coatings", note: "Ceramic and paint coatings" },
  { cat: "ppf", title: "Paint film", note: "Paint protection film" },
  { cat: "tinting", title: "Window film", note: "Tint and heat control" },
];

function MapCanvas({ onPress }: { onPress: () => void }) {
  const { name, colors } = useExperienceTheme();
  const night = name !== "light";
  const land = night ? "#16181C" : "#DDE1E6";
  const block = night ? "#1D2025" : "#E9ECEF";
  const road = night ? "#2A2D33" : "#F7F8FA";
  const park = night ? "#18241E" : "#D3E3D8";
  const label = night ? "#7C8088" : "#8A9099";
  const bar = (style: object) => <View style={{ position: "absolute", backgroundColor: road, borderRadius: 6, ...style }} />;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Open the studio in maps" onPress={onPress} style={{ height: 330, borderRadius: 24, overflow: "hidden", backgroundColor: land }}>
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
        <View style={{ width: 54, height: 54, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: night ? "#F3F1ED" : "#16181C", ...(Platform.OS === "web" ? ({ boxShadow: "0 12px 22px rgba(0,0,0,.35)" } as object) : {}) }}>
          <Icon name="garage" color={night ? "#16181C" : "#FFFFFF"} size={26} />
        </View>
        <View style={{ borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.surface }}><Text style={{ color: colors.textPrimary, fontSize: 11, fontWeight: "800" }}>AutoDeck</Text></View>
      </View>
    </Pressable>
  );
}

export default function StudioScreen() {
  const router = useRouter();
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const [hours, setHours] = useState<string>(STUDIO_INFO.hours);
  useEffect(() => {
    let alive = true;
    void getStudioInfo(FIRST_STUDIO_ID).then((i) => { if (alive && i.operatingHours?.length) setHours(formatHours(i.operatingHours)); }).catch(() => undefined);
    return () => { alive = false; };
  }, []);
  return (
    <Screen>
      <View style={{ gap: 14, paddingBottom: 20 }}>
        <View>
          <MapCanvas onPress={() => void Linking.openURL(STUDIO_INFO.mapsUrl)} />
          <View pointerEvents="box-none" style={{ position: "absolute", left: 14, right: 14, top: 14, flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Directions" onPress={() => void Linking.openURL(STUDIO_INFO.mapsUrl)} style={{ width: 46, height: 46, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: name === "light" ? "#16181C" : "#F3F1ED" }}>
              <Text style={{ color: name === "light" ? "#FFFFFF" : "#16181C", fontSize: 20, fontWeight: "800" }}>{"\u2197"}</Text>
            </Pressable>
          </View>
        </View>
        <View style={{ marginTop: -46, marginHorizontal: 8, padding: 18, gap: 12, borderRadius: 24, ...r.sheet }}>
          <Text style={{ color: colors.textPrimary, fontSize: 22, fontWeight: "800" }}>AutoDeck Studio</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 18 }}>{STUDIO_INFO.address}</Text>
          <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{hours}</Text>
          <View style={{ gap: 8 }}>
            {ROWS.map((row) => (
              <Pressable key={row.cat} accessibilityRole="button" onPress={() => router.push({ pathname: "/(tabs)/catalogue", params: { cat: row.cat } })} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, opacity: pressed ? 0.8 : 1, ...r.well })}>
                <View style={{ width: 40, height: 40, borderRadius: 16, alignItems: "center", justifyContent: "center", ...r.round }}><Icon name="services" color="#EC8638" size={18} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "700" }}>{row.title}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12 }}>{row.note}</Text>
                </View>
                <Text style={{ color: colors.textTertiary, fontSize: 18 }}>›</Text>
              </Pressable>
            ))}
          </View>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 }}>
            <Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/catalogue")} style={({ pressed }) => ({ flex: 1, height: 54, borderRadius: 24, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...r.dark })}>
              <Text style={{ color: name === "light" ? "#FFFFFF" : "#16181C", fontSize: 15, fontWeight: "800" }}>Start booking</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Call the studio" onPress={() => void Linking.openURL(`tel:${STUDIO_INFO.phone}`)} style={{ width: 54, height: 54, borderRadius: 24, alignItems: "center", justifyContent: "center", ...r.round }}>
              <Icon name="phone" color={colors.textPrimary} size={22} />
            </Pressable>
          </View>
        </View>
      </View>
    </Screen>
  );
}
