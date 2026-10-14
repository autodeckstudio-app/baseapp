// Care map: a top-down car with tappable zones. Each zone shows whether the
// paint or glass there has protection from past AutoDeck visits, and offers
// the matching service. Built from plain views so it works on every phone.
import { createElement, useMemo, useRef, useState } from "react";
import { Image, PanResponder, Platform, Pressable, Text, View } from "react-native";
import { Icon, useExperienceTheme } from "@autodeck/ui/native";
import { Car3D, car3dSupported } from "./Car3D";
import { raised } from "../lib/raised";
import { VIEW, bodyColour, carSvg, shapeFor, shapeLabel, svgUri, zonesFor, type ZoneKey } from "../lib/car-models";

export type CareDone = { ppf: string | null; coating: string | null; tint: string | null };
type Zone = { key: ZoneKey; label: string; kind: "paint" | "glass" };
const ZONES: Zone[] = [
  { key: "hood", label: "Bonnet", kind: "paint" },
  { key: "windshield", label: "Windshield", kind: "glass" },
  { key: "roof", label: "Roof", kind: "paint" },
  { key: "rear", label: "Rear glass", kind: "glass" },
  { key: "trunk", label: "Boot", kind: "paint" },
  { key: "left", label: "Left doors", kind: "paint" },
  { key: "right", label: "Right doors", kind: "paint" },
];
const CHIPS = [{ key: "all", label: "All" }, { key: "paint", label: "Paint" }, { key: "glass", label: "Glass" }] as const;

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
}

export function CareMap({ done, onBook, category, make, model, colour }: { done: CareDone; onBook: (category: "ppf" | "coating" | "tinting") => void; category?: string | null; make?: string | null; model?: string | null; colour?: string | null }) {
  const { name, colors } = useExperienceTheme();
  const r = raised(name);
  const night = name !== "light";
  const web = Platform.OS === "web";
  const [chip, setChip] = useState<(typeof CHIPS)[number]["key"]>("all");
  const [sel, setSel] = useState<ZoneKey>("hood");
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const shape = shapeFor(category, make, model);
  const zp = useMemo(() => zonesFor(shape), [shape]);
  const uri = useMemo(() => svgUri(carSvg(shape, bodyColour(colour), night, sel)), [shape, colour, night, sel]);
  const pan = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_e, g) => setTilt({ x: Math.max(-14, Math.min(14, -g.dy / 8)), y: Math.max(-28, Math.min(28, g.dx / 5)) }),
    onPanResponderRelease: () => setTilt({ x: 0, y: 0 }),
    onPanResponderTerminate: () => setTilt({ x: 0, y: 0 }),
  })).current;
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

      <View {...pan.panHandlers} style={{ alignItems: "center", paddingVertical: 14, borderRadius: 30, ...r.sheet }}>
        <Text style={{ color: colors.textTertiary, fontSize: 11, fontWeight: "600", marginBottom: 6 }}>{shapeLabel(shape)} view. Drag to turn the car.</Text>
        {car3dSupported ? (
          <View style={{ width: 320, height: 250 }}>
            <Car3D shape={shape} colour={bodyColour(colour)} night={night} selected={sel} zones={zones.map((z) => ({ key: z.key, label: z.label, ok: status(z).ok }))} anchors={zp} onSelect={setSel} width={320} height={250} />
          </View>
        ) : (
        <View style={{ width: VIEW.w, height: VIEW.h, ...(web ? ({ transform: `perspective(900px) rotateX(${12 + tilt.x}deg) rotateY(${tilt.y}deg)`, transformOrigin: "50% 55%", transition: "transform 160ms ease-out" } as object) : {}) }}>
          {web ? createElement("img", { src: uri, width: VIEW.w, height: VIEW.h, alt: "", draggable: false, style: { display: "block", pointerEvents: "none" } }) : <Image source={{ uri }} resizeMode="contain" style={{ width: VIEW.w, height: VIEW.h }} />}
          {zones.map((z) => {
            const s2 = status(z);
            const on = z.key === sel;
            const [px, py] = zp[z.key];
            return (
              <Pressable key={z.key} accessibilityRole="button" accessibilityLabel={`${z.label}, ${s2.text}`} onPress={() => setSel(z.key)} hitSlop={8} style={{ position: "absolute", left: (px / 100) * VIEW.w - 17, top: (py / 100) * VIEW.h - 17, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", borderWidth: on ? 2 : 0, borderColor: "#EC8638", ...r.round }}>
                <Icon name={s2.ok ? "check" : "plus"} color={s2.ok ? "#2E9E6B" : colors.textSecondary} size={16} />
              </Pressable>
            );
          })}
        </View>
        )}
      </View>

      <View style={{ borderRadius: 24, padding: 16, gap: 8, ...r.card }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ color: colors.textPrimary, fontSize: 17, fontWeight: "800" }}>{zone.label}</Text>
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, ...r.well, borderRadius: 12 }}><Text style={{ color: st.ok ? "#2E9E6B" : colors.accentStrong, fontSize: 12, fontWeight: "800" }}>{st.ok ? "Protected" : "Open"}</Text></View>
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{st.text}{st.when ? `, ${st.when}` : ""}</Text>
        <Pressable accessibilityRole="button" onPress={() => onBook(st.cat)} style={({ pressed }) => ({ height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, ...(st.ok ? r.quiet : r.primary) })}>
          <Text style={{ color: colors.textPrimary, fontSize: 14, fontWeight: "800" }}>{st.ok ? "Book again" : st.cta}</Text>
        </Pressable>
      </View>
    </View>
  );
}
