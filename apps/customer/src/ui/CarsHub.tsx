import { SelectField } from "./inputs";
// Cars for sale: studio stock and approved customer cars as a grid of photo cards, plus "Sell your car" and your own listings.
import { useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, TextInput, View } from "react-native";
import { NavIcon } from "./NavIcon";
import { useExperienceTheme } from "@autodeck/ui/native";
import type { CarListingView } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Field, Kicker, Notice, Screen, Skeleton, T } from "./kit";
import { hasCarPrice } from "../lib/cars-home";
import { glassPane } from "../lib/glass-pane";
import { filterCars } from "../lib/car-filters";
import { inr, kmLabel } from "../lib/carsale-service";

const STATE: Record<string, string> = { pending: "Waiting for review", live: "Live", reserved: "Reserved", sold: "Sold", rejected: "Not approved", expired: "Expired", draft: "Draft" };

const BUDGETS: Array<{ id: string; label: string; max: number }> = [
  { id: "any", label: "Any budget", max: Infinity },
  { id: "5", label: "Under ₹5 lakh", max: 500000 * 100 },
  { id: "10", label: "Under ₹10 lakh", max: 1000000 * 100 },
  { id: "20", label: "Under ₹20 lakh", max: 2000000 * 100 },
];
const BODY_FILTERS = ["hatchback", "sedan", "suv", "muv", "coupe", "other"];
const FUEL_FILTERS = ["petrol", "diesel", "cng", "electric", "hybrid"];

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const night = useExperienceTheme().name === "night";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 10, minHeight:44,justifyContent:"center", backgroundColor: on ? "rgba(236,134,56,0.16)" : night ? "rgba(255,255,255,0.08)" : "rgba(29,27,38,0.06)", borderWidth: 1, borderColor: on ? "#EC8638" : night ? "rgba(255,255,255,0.28)" : "rgba(29,27,38,0.16)" }}
    >
      <T role="label" style={{ color: on ? (night ? "#F59A4E" : "#B8500A") : night ? "#FAF8F5" : "#1D1B26", textTransform: "capitalize" }}>{label}</T>
    </Pressable>
  );
}

function Choice({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:Array<{value:string;label:string}>}) {
  if(Platform.OS==="web") return <SelectField label={label} value={value} onChange={onChange} options={options}/>;
  return <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{options.map(o=><Pill key={o.value} label={o.label} on={value===o.value} onPress={()=>onChange(o.value)}/>)}</View>;
}

function carFacts(l: CarListingView) {
  const fuel = l.fuel ? l.fuel.charAt(0).toUpperCase() + l.fuel.slice(1) : "";
  return [l.year, fuel, kmLabel(l.kmDriven)].filter(Boolean).join(" · ");
}

function Photo({ l, style }: { l: CarListingView; style: object }) {
  return l.photoUrls[0]
    ? <Image source={{ uri: l.photoUrls[0] }} resizeMode="cover" style={style} />
    : <View style={[style, { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(128,128,136,0.2)" }]}><T tone="tertiary" role="caption">No photo</T></View>;
}

/** The first car: a wide photo with the studio or customer tag, name and price underneath. */
function FeatureCard({ l, onPress }: { l: CarListingView; onPress: () => void }) {
  const day = useExperienceTheme().name === "light";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${l.year} ${l.make} ${l.model}, ${hasCarPrice(l) ? inr(l.askingPrice) : "price on request"}`} onPress={onPress} style={({ pressed }) => ({ width: "100%", overflow: "hidden", opacity: pressed ? 0.85 : 1, ...glassPane(day) })}>
      <View>
        <Photo l={l} style={{ width: "100%", height: 132 }} />
        <View style={{ position: "absolute", top: 12, left: 12, backgroundColor: "rgba(10,10,12,.82)", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6 }}><T role="caption" style={{ color: "#FFFFFF" }}>{l.status === "reserved" ? "Reserved" : l.source === "studio" ? "Studio listing" : "Customer listing"}</T></View>
      </View>
      <View style={{ paddingHorizontal: 14, paddingVertical: 12, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
          <T role="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{l.make} {l.model}</T>
          <T role="bodyStrong">{hasCarPrice(l) ? inr(l.askingPrice) : "Ask price"}</T>
        </View>
        <T role="caption" tone="tertiary" numberOfLines={1}>{carFacts(l)}{l.variant ? ` · ${l.variant}` : ""}</T>
      </View>
    </Pressable>
  );
}

/** Every other car: a compact row with a small photo. */
function RowCard({ l, onPress }: { l: CarListingView; onPress: () => void }) {
  const day = useExperienceTheme().name === "light";
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`View ${l.year} ${l.make} ${l.model}, ${hasCarPrice(l) ? inr(l.askingPrice) : "price on request"}`} onPress={onPress} style={({ pressed }) => ({ width: "100%", flexDirection: "row", alignItems: "center", gap: 14, padding: 10, opacity: pressed ? 0.85 : 1, ...glassPane(day) })}>
      <Photo l={l} style={{ width: 96, height: 66, borderRadius: 12 }} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
          <T role="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{l.make} {l.model}</T>
          <T role="bodyStrong">{hasCarPrice(l) ? inr(l.askingPrice) : "Ask price"}</T>
        </View>
        <T role="caption" tone="tertiary" numberOfLines={1}>{l.status === "reserved" ? "Reserved · " : ""}{carFacts(l)}</T>
      </View>
    </Pressable>
  );
}

type Tab = "buy" | "sell";

/** BUY | SELL: one switch inside one Cars screen. */
function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const night = useExperienceTheme().name === "night";
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: "row", padding: 4, gap: 4, ...glassPane(!night), borderRadius: 9999 }}>
      {(["buy", "sell"] as Tab[]).map((t) => {
        const on = tab === t;
        return (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t === "buy" ? "Buy a car" : "Sell your car"} onPress={() => onChange(t)}
            style={{ flex: 1, minHeight: 44, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: on ? (night ? "#FAF8F5" : "#1D1B26") : "transparent" }}>
            <T role="label" style={{ color: on ? (night ? "#1D1B26" : "#FFFFFF") : night ? "#FAF8F5" : "#1D1B26", letterSpacing: 1, fontWeight: "800" }}>{t === "buy" ? "BUY" : "SELL"}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Rounded search box with the magnifier, as on the website preview. */
function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const night = useExperienceTheme().name === "night";
  const ink = night ? "#FAF8F5" : "#1D1B26";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 16, ...glassPane(!night), borderRadius: 9999 }}>
      <NavIcon name="search" color={night ? "rgba(250,248,245,0.7)" : "#6B6878"} size={20} cut="transparent" />
      <TextInput accessibilityLabel="Search cars" value={value} onChangeText={onChange} placeholder="Make, model, year or area" placeholderTextColor={night ? "rgba(250,248,245,0.5)" : "#8A8796"} autoCapitalize="none" maxLength={60} style={[{ flex: 1, color: ink, fontSize: 15, paddingVertical: 10 }, Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null]} />
    </View>
  );
}

const SELL_STEPS: Array<{ n: string; title: string; body: string }> = [
  { n: "1", title: "Add your car", body: "Make, model, year, kilometres and clear photos of your own car." },
  { n: "2", title: "The studio reviews it", body: "Your listing goes live once the studio has checked it." },
  { n: "3", title: "Enquiries come to the studio", body: "Buyers enquire through AutoDeck. You see their status under your listings." },
];

function SellHub({ mine, onSell, onOpen }: { mine: CarListingView[]; onSell: () => void; onOpen: (id: string) => void }) {
  const night = useExperienceTheme().name === "night";
  return (
    <View style={{ gap: space.inset }}>
      <View style={{ padding: 20, gap: 14, ...glassPane(!night) }}>
        <Kicker>Sell your car</Kicker>
        <T role="heading">List it with AutoDeck</T>
        <T tone="secondary">Add your car once. The studio reviews it and shows it to buyers in the app.</T>
        <Button label="List your car" onPress={onSell} />
      </View>
      <View style={{ gap: space.line }}>
        {SELL_STEPS.map((st) => (
          <View key={st.n} style={{ flexDirection: "row", gap: 14, alignItems: "flex-start", padding: 16, ...glassPane(!night) }}>
            <View style={{ width: 36, height: 36, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: night ? "rgba(255,255,255,0.10)" : "rgba(29,27,38,0.06)" }}><T role="label">{st.n}</T></View>
            <View style={{ flex: 1, gap: 2 }}><T role="bodyStrong">{st.title}</T><T role="caption" tone="secondary">{st.body}</T></View>
          </View>
        ))}
      </View>
      {mine.length > 0 ? (
        <View style={{ gap: space.breath }}>
          <Kicker>Your cars for sale</Kicker>
          {mine.map((l) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => onOpen(l.id)} style={{ flexDirection: "row", gap: space.line, alignItems: "center" }}>
              <Image source={{ uri: l.photoUrls[0] }} resizeMode="cover" style={{ width: 72, height: 72, borderRadius: 12 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T role="bodyStrong" numberOfLines={1}>{l.year} {l.make} {l.model}</T>
                <T role="caption" tone="tertiary">{hasCarPrice(l) ? inr(l.askingPrice) : "Price on request"}</T>
                {l.status === "rejected" && l.rejectionReason ? <T role="caption" tone="secondary" numberOfLines={2}>{l.rejectionReason}</T> : null}
              </View>
              <Chip label={STATE[l.status] ?? l.status} tone={l.status === "live" ? "accent" : l.status === "rejected" ? "danger" : "neutral"} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}


export function CarsHub({ all, mine, error, initialTab = "buy", onRetry, onOpen, onSell, header, initialFiltersOpen = false }: { initialFiltersOpen?: boolean; header?: React.ReactNode; all: CarListingView[] | null; mine: CarListingView[]; error: boolean; initialTab?: Tab; onRetry: () => void; onOpen: (id: string) => void; onSell: () => void }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  useEffect(() => { setTab(initialTab); }, [initialTab]);
  const [query, setQuery] = useState("");
  const [fuel, setFuel] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [budget, setBudget] = useState("any");
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const themeNight = useExperienceTheme().name === "night";
  const [sort, setSort] = useState<"new" | "low" | "high">("new");
  const shown = useMemo(() => filterCars(all ?? [], { query, fuel, body, maxPrice: BUDGETS.find((b) => b.id === budget)?.max ?? Infinity, sort }), [all, query, fuel, body, budget, sort]);
  const filtering = query.trim() !== "" || fuel !== null || body !== null || budget !== "any";
  const clear = () => { setQuery(""); setFuel(null); setBody(null); setBudget("any"); };
  const chipBorder = themeNight ? "rgba(255,255,255,0.28)" : "rgba(29,27,38,0.16)";
  return (
    <Screen {...(header ? { header } : { appBar: "Cars" })}>
      <TabSwitch tab={tab} onChange={setTab} />
      {tab === "sell" ? <SellHub mine={mine} onSell={onSell} onOpen={onOpen} /> : null}
      {tab === "buy" ? <View style={{ gap: 4 }}><T role="heading">Cars for sale</T><T tone="secondary">Explore cars listed through AutoDeck. Clear facts, real photos, enquiries handled by the studio.</T></View> : null}
      {tab === "buy" && all && all.length > 0 ? (
        <View style={{ gap: space.line }}>
          <SearchBox value={query} onChange={setQuery} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {BUDGETS.filter((b) => b.id !== "any").map((b) => {
              const on = budget === b.id;
              return (
                <Pressable key={b.id} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setBudget(on ? "any" : b.id)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 9999, borderWidth: 1, justifyContent: "center", borderColor: on ? "#EC8638" : chipBorder, backgroundColor: on ? "rgba(236,134,56,0.16)" : themeNight ? "rgba(255,255,255,0.08)" : "#FFFFFF" }}>
                  <T role="label" style={{ textTransform: "none", letterSpacing: 0, color: on ? (themeNight ? "#F59A4E" : "#B8500A") : themeNight ? "#FAF8F5" : "#1D1B26" }}>{b.label}</T>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="More filters and sort" accessibilityState={{ expanded: filtersOpen }} onPress={() => setFiltersOpen(!filtersOpen)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 9999, borderWidth: 1, justifyContent: "center", borderColor: fuel || body || sort !== "new" ? "#EC8638" : chipBorder, backgroundColor: themeNight ? "rgba(255,255,255,0.08)" : "#FFFFFF" }}><T role="label" style={{ textTransform: "none", letterSpacing: 0 }}>More</T></Pressable>
          </View>
          {filtersOpen ? <View style={{ padding: 16, gap: 16, ...glassPane(!themeNight) }}>
            <View style={{ gap: 8 }}><Kicker>Budget</Kicker><Choice label="Car budget" value={budget} onChange={setBudget} options={BUDGETS.map((b) => ({ value: b.id, label: b.label }))} /></View>
            <View style={{ gap: 8 }}><Kicker>Fuel</Kicker><Choice label="Car fuel" value={fuel ?? ""} onChange={(v) => setFuel(v || null)} options={[{ value: "", label: "Any fuel" }, ...FUEL_FILTERS.map((f) => ({ value: f, label: f.toUpperCase() === "CNG" ? "CNG" : f[0]!.toUpperCase() + f.slice(1) }))]} /></View>
            <View style={{ gap: 8 }}><Kicker>Body type</Kicker><Choice label="Car body type" value={body ?? ""} onChange={(v) => setBody(v || null)} options={[{ value: "", label: "Any body type" }, ...BODY_FILTERS.map((b) => ({ value: b, label: ["suv", "muv"].includes(b) ? b.toUpperCase() : b[0]!.toUpperCase() + b.slice(1) }))]} /></View>
            <View style={{ gap: 8 }}><Kicker>Sort</Kicker><Choice label="Sort cars" value={sort} onChange={(v) => setSort(v as typeof sort)} options={[{ value: "new", label: "Newest first" }, { value: "low", label: "Price: low to high" }, { value: "high", label: "Price: high to low" }]} /></View>
            <Button label={`Show ${shown.length} car${shown.length === 1 ? "" : "s"}`} onPress={() => setFiltersOpen(false)} />
          </View> : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}><T role="caption" tone="tertiary">{shown.length} car{shown.length === 1 ? "" : "s"}{filtering ? " match your search" : " to explore"}</T>{filtering ? <Pressable accessibilityRole="button" accessibilityLabel="Clear car filters and search" onPress={clear} style={{ minHeight: 44, justifyContent: "center" }}><T role="caption" tone="accent">Clear all</T></Pressable> : null}</View>
        </View>
      ) : null}
      {tab === "buy" && error ? <Notice title="Can't load cars" body="Check your connection and try again." action={<Button kind="quiet" label="Retry" onPress={onRetry} />} /> : null}
      {tab === "buy" && !all && !error ? <View style={{ gap: space.line }}><Skeleton height={200} /><Skeleton height={90} /></View> : null}
      {tab === "buy" && all && all.length === 0 ? <Notice title="No cars listed yet" body="New cars appear here as soon as the studio lists them." /> : null}
      {tab === "buy" && all && all.length > 0 && shown.length === 0 && filtering ? <Notice title="No cars match" body="Try a wider budget or clear the search." action={<Button kind="quiet" label="Clear filters" onPress={clear} />} /> : null}
      {tab === "buy" && shown.length > 0 ? (
        <View style={{ gap: 12 }}>
          {shown.map((l, i) => i === 0 ? <FeatureCard key={l.id} l={l} onPress={() => onOpen(l.id)} /> : <RowCard key={l.id} l={l} onPress={() => onOpen(l.id)} />)}
        </View>
      ) : null}
      <T role="caption" tone="tertiary">AutoDeck lists cars to help buyers and sellers meet. We are not a party to the sale, and ownership papers and transfer are between buyer and seller.</T>
    </Screen>
  );
}
