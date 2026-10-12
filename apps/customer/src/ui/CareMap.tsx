// Care map: a top-down car with tappable zones. Each zone shows whether the
// paint or glass there has protection from past AutoDeck visits, and offers
// the matching service. Built from plain views so it works on every phone.
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { raised } from "../lib/raised";

export type CareDone = { ppf: string | null; coating: string | null; tint: string | null };
type Zone = { key: string; label: string; kind: "paint" | "glass"; x: number; y: number };
const ZONES: Zone[] = [
  { key: "hood", label: "Bonnet", kind: "paint", x: 140, y: 78 },
  { key: "windshield", label: "Windshield", kind: "glass", x: 140, y: 150 },
  { key: "roof", label: "Roof", kind: "paint", x: 140, y: 212 },
  { key: "rear", label: "Rear glass", kind: "glass", x: 140, y: 276 },
  { key: "trunk", label: "Boot", kind: "paint", x: 140, y: 334 },
  { key: "left", label: "Left doors", kind: "paint", x: 76, y: 212 },
  { key: "right", label: "Right doors", kind: "paint", x: 204, y: 212 },
];
const CHIPS = [{ key: "all", label: "All" }, { key: "paint", label: "Paint" }, { key: "glass", label: "Glass" }] as const;

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export function CareMap({ done, onBook }: { done: CareDone; onBook: (category: "ppf" | "coating" | "tinting") => void }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const night = name !== "light";
  const web = Platform.OS === "web";
  const [chip, setChip] = useState<(typeof CHIPS)[number]["key"]>("all");
  const [sel, setSel] = useState<string>("hood");
  const zones = ZONES.filter((z) => chip === "all" || z.kind === chip);
  const zone = ZONES.find((z) => z.key === sel) ?? ZONES[0]!;
  const status = (z: Zone): { ok: boolean; text: string; when: string; cta: string; cat: "ppf" | "coating" | "tinting" } => {
    if (z.kind === "glass") return done.tint ? { ok: true, text: "Window film fitted", when: fmt(done.tint), cta: "Book window film", cat: "tinting" } : { ok: false, text: "No window film on record", when: "", cta: "Book window film", cat: "tinting" };
    if (done.ppf) return { ok: true, text: "Paint film fitted", when: fmt(done.ppf), cta: "Book paint film", cat: "ppf" };
    if (done.coating) return { ok: true, text: "Coating applied", when: fmt(done.coating), cta: "Book a coating", cat: "coating" };
    return { ok: false, text: "No paint protection on record", when: "", cta: "Protect the paint", cat: "ppf" };
  };
  const st = status(zone);
  const body = night ? ["#3C3F46", "#1B1D21"] : ["#D3D8DF", "#9EA5AF"];
  const glass = night ? "#0C0D0F" : "#2B2F36";
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        {CHIPS.map((c) => (
          <Pressable key={c.key} accessibilityRole="button" accessibilityState={{ selected: chip === c.key }} onPress={() => { setChip(c.key); const f = ZONES.find((z) => c.key === "all" || z.kind === c.key); if (f && !(c.key === "all" || zone.kind === c.key)) setSel(f.key); }} style={{ flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 18, ...(chip === c.key ? r.well : r.quiet) }}>
            <Text style={{ color: chip === c.key ? colors.accentStrong : colors.textSecondary, fontSize: 13, fontWeight: "700" }}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: "center", paddingVertical: 8, borderRadius: 30, ...r.sheet }}>
        <View style={{ width: 280, height: 400, ...(web ? ({ transform: "perspective(900px) rotateX(14deg)", transformOrigin: "50% 60%" } as object) : {}) }}>
          {[ [34, 76], [228, 76], [34, 262], [228, 262] ].map(([x, y], i) => (
            <View key={i} style={{ position: "absolute", left: x, top: y, width: 18, height: 54, borderRadius: 9, backgroundColor: night ? "#08090A" : "#2A2D33" }} />
          ))}
          <View style={{ position: "absolute", left: 48, top: 14, width: 184, height: 372, borderRadius: 86, ...(web ? ({ backgroundImage: `linear-gradient(90deg, ${body[1]}, ${body[0]} 38%, ${body[0]} 62%, ${body[1]})`, boxShadow: night ? "0 26px 40px rgba(0,0,0,.65), inset 0 2px 0 rgba(255,255,255,.12)" : "0 26px 40px rgba(110,118,130,.55), inset 0 2px 0 rgba(255,255,255,.7)" } as object) : { backgroundColor: body[0] ?? "#999" }) }} />
          <View style={{ position: "absolute", left: 66, top: 118, width: 148, height: 58, borderRadius: 22, backgroundColor: glass, opacity: 0.9 }} />
          <View style={{ position: "absolute", left: 66, top: 252, width: 148, height: 50, borderRadius: 20, backgroundColor: glass, opacity: 0.9 }} />
          <View style={{ position: "absolute", left: 76, top: 184, width: 128, height: 62, borderRadius: 18, backgroundColor: night ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.35)" }} />
          <View style={{ position: "absolute", left: 22, top: 150, width: 30, height: 14, borderRadius: 7, backgroundColor: body[1] }} />
          <View style={{ position: "absolute", left: 228, top: 150, width: 30, height: 14, borderRadius: 7, backgroundColor: body[1] }} />
          {zones.map((z) => {
            const s = status(z);
            const on = z.key === sel;
            return (
              <Pressable key={z.key} accessibilityRole="button" accessibilityLabel={`${z.label}, ${s.text}`} onPress={() => setSel(z.key)} hitSlop={6} style={{ position: "absolute", left: z.x - 19, top: z.y - 19, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", ...(on ? r.roundOn : r.round) }}>
                <Icon name={s.ok ? "check" : "plus"} color={on ? "#1A1410" : s.ok ? "#2E9E6B" : "#EC8638"} size={18} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ borderRadius: 24, padding: 16, gap: 8, ...r.card }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{zone.label}</Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, ...r.well, borderRadius: 12 }}><Text style={{ color: st.ok ? "#2E9E6B" : colors.accentStrong, fontSize: 12, fontWeight: "800" }}>{st.ok ? "Protected" : "Open"}</Text></View>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{st.text}{st.when ? `, ${st.when}` : ""}</Text>
        <Pressable accessibilityRole="button" onPress={() => onBook(st.cat)} style={({ pressed }) => ({ height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...(st.ok ? r.quiet : r.primary) })}>
          <Text style={{ color: st.ok ? colors.textPrimary : "#1A1410", fontSize: 14, fontWeight: "800" }}>{st.ok ? "Book again" : st.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}
