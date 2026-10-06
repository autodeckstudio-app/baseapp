// Cars for sale: studio stock and approved customer cars as a grid of photo cards, plus "Sell your car" and your own listings.
import { createElement, useEffect, useMemo, useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import type { CarListingView } from "@autodeck/core";
import { space } from "@autodeck/ui/theme";
import { Button, Chip, Field, Kicker, Notice, Screen, Skeleton, T } from "../../../ui/kit";
import { filterCars } from "../../../lib/car-filters";
import { getCarListings, inr, kmLabel } from "../../../lib/carsale-service";

const STATE: Record<string, string> = { pending: "Waiting for review", live: "Live", reserved: "Reserved", sold: "Sold", rejected: "Not approved", expired: "Expired", draft: "Draft" };

const BUDGETS: Array<{ id: string; label: string; max: number }> = [
  { id: "any", label: "Any budget", max: Infinity },
  { id: "5", label: "Under 5 lakh", max: 500000 * 100 },
  { id: "10", label: "Under 10 lakh", max: 1000000 * 100 },
  { id: "20", label: "Under 20 lakh", max: 2000000 * 100 },
];
const BODY_FILTERS = ["hatchback", "sedan", "suv", "muv", "coupe", "other"];
const FUEL_FILTERS = ["petrol", "diesel", "cng", "electric", "hybrid"];

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={{ borderRadius: 9999, paddingHorizontal: 14, paddingVertical: 10, minHeight:44,justifyContent:"center", backgroundColor: on ? "#EC8638" : "rgba(255,255,255,0.10)", borderWidth: 1, borderColor: on ? "#EC8638" : "rgba(255,255,255,0.18)" }}
    >
      <T role="label" style={{ color: on ? "#1A1410" : "#E4E2DF", textTransform: "capitalize" }}>{label}</T>
    </Pressable>
  );
}

function Choice({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:Array<{value:string;label:string}>}) {
  if(Platform.OS==="web") return createElement("select",{"aria-label":label,value,onChange:(e:{target:{value:string}})=>onChange(e.target.value),style:{width:"100%",minWidth:0,minHeight:48,padding:"0 14px",borderRadius:14,border:"1px solid #454548",background:"#202023",color:"#F6F4F1",fontSize:15,fontFamily:"Inter,system-ui,sans-serif",colorScheme:"dark"}},options.map(o=>createElement("option",{key:o.value,value:o.value},o.label)));
  return <View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{options.map(o=><Pill key={o.value} label={o.label} on={value===o.value} onPress={()=>onChange(o.value)}/>)}</View>;
}

function Card({ l, onPress }: { l: CarListingView; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`View ${l.year} ${l.make} ${l.model}, ${inr(l.askingPrice)}`} onPress={onPress} style={({pressed}) => ({width:"100%",borderRadius:24,overflow:"hidden",backgroundColor:"#151517",borderWidth:1,borderColor:"rgba(255,255,255,.10)",opacity:pressed?.85:1})}>
    <View style={{aspectRatio:3/2,backgroundColor:"#202023"}}>{l.photoUrls[0] ? <Image source={{uri:l.photoUrls[0]}} resizeMode="cover" style={{width:"100%",height:"100%"}}/> : <View style={{flex:1,alignItems:"center",justifyContent:"center"}}><T tone="tertiary">Photo unavailable</T></View>}
      <View style={{position:"absolute",top:14,left:14,backgroundColor:"rgba(10,10,12,.82)",borderRadius:999,paddingHorizontal:12,paddingVertical:6}}><T role="caption">{l.status==="reserved" ? "Reserved" : l.source==="studio" ? "Studio listing" : "Customer listing"}</T></View>
    </View>
    <View style={{padding:20,gap:10}}><View style={{flexDirection:"row",justifyContent:"space-between",gap:12}}><View style={{flex:1,gap:4}}><T role="heading">{l.make} {l.model}</T><T role="caption" tone="secondary">{l.year}{l.variant ? ` · ${l.variant}` : ""}</T></View><T role="heading" tone="accent">{inr(l.askingPrice)}</T></View>
      <T role="caption" tone="tertiary" style={{textTransform:"capitalize"}}>{kmLabel(l.kmDriven)} · {l.fuel} · {l.gearbox}</T><View style={{flexDirection:"row",justifyContent:"space-between"}}><T role="caption" tone="tertiary">{l.area}</T><T role="caption" tone="accent">View car ›</T></View>
    </View>
  </Pressable>;
}

export default function CarsScreen() {
  const router = useRouter();
  const [all, setAll] = useState<CarListingView[] | null>(null);
  const [mine, setMine] = useState<CarListingView[]>([]);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [fuel, setFuel] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [budget, setBudget] = useState("any");
  const [filtersOpen,setFiltersOpen] = useState(false);
  const [attempt,setAttempt] = useState(0);
  const [sort, setSort] = useState<"new" | "low" | "high">("new");
  const shown = useMemo(() => filterCars(all??[],{query,fuel,body,maxPrice:BUDGETS.find(b=>b.id===budget)?.max??Infinity,sort}),[all,query,fuel,body,budget,sort]);
  const filtering = query.trim() !== "" || fuel !== null || body !== null || budget !== "any";
  useEffect(() => {
    setError(false);
    getCarListings(false).then(setAll).catch(() => setError(true));
    getCarListings(true).then(setMine).catch(() => undefined);
  }, [attempt]);

  return (
    <Screen
      top={
        <View style={{ gap: space.hair }}>
          <Kicker tone="accent">Cars for sale</Kicker>
          <T role="title">Find your next car</T>
        </View>
      }
    >
      <T tone="secondary">Explore cars listed through AutoDeck. Clear facts, real photos, enquiries handled by the studio.</T>
      <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",paddingVertical:8,borderBottomWidth:1,borderBottomColor:"rgba(255,255,255,.12)"}}><T role="caption" tone="tertiary">Have a car to sell?</T><Pressable accessibilityRole="button" onPress={() => router.push("/(tabs)/cars/sell")} style={{minHeight:44,justifyContent:"center"}}><T tone="accent">List your car ›</T></Pressable></View>
      {all && all.length > 0 ? (
        <View style={{ gap: space.line }}>
          <Field label="Search" value={query} onChangeText={setQuery} placeholder="Make, model, year or area" autoCapitalize="none" maxLength={60} />
          <View style={{flexDirection:"row",alignItems:"center",gap:12}}>
            <Pressable accessibilityRole="button" accessibilityLabel="Filter cars" accessibilityState={{expanded:filtersOpen}} onPress={()=>setFiltersOpen(!filtersOpen)} style={{minHeight:48,paddingHorizontal:18,borderRadius:999,borderWidth:1,borderColor:filtering?"#F59A45":"#454548",backgroundColor:"#202023",justifyContent:"center"}}><T role="bodyStrong">Filters{[fuel,body,budget!=="any"?budget:null].filter(Boolean).length ? ` · ${[fuel,body,budget!=="any"?budget:null].filter(Boolean).length}`:""} {filtersOpen?"−":"+"}</T></Pressable>
            <View style={{flex:1}}><Choice label="Sort cars" value={sort} onChange={v=>setSort(v as typeof sort)} options={[{value:"new",label:"Newest first"},{value:"low",label:"Price: low to high"},{value:"high",label:"Price: high to low"}]}/></View>
          </View>
          {filtersOpen ? <View style={{padding:18,gap:16,borderRadius:20,borderWidth:1,borderColor:"#3B3B3F",backgroundColor:"#18181B"}}>
            <View style={{gap:8}}><Kicker>Budget</Kicker><Choice label="Car budget" value={budget} onChange={setBudget} options={BUDGETS.map(b=>({value:b.id,label:b.label}))}/></View>
            <View style={{gap:8}}><Kicker>Fuel</Kicker><Choice label="Car fuel" value={fuel??""} onChange={v=>setFuel(v||null)} options={[{value:"",label:"Any fuel"},...FUEL_FILTERS.map(f=>({value:f,label:f.toUpperCase()==="CNG"?"CNG":f[0]!.toUpperCase()+f.slice(1)}))]}/></View>
            <View style={{gap:8}}><Kicker>Body type</Kicker><Choice label="Car body type" value={body??""} onChange={v=>setBody(v||null)} options={[{value:"",label:"Any body type"},...BODY_FILTERS.map(b=>({value:b,label:["suv","muv"].includes(b)?b.toUpperCase():b[0]!.toUpperCase()+b.slice(1)}))]}/></View>
            <Button label={`Show ${shown.length} car${shown.length===1?"":"s"}`} onPress={()=>setFiltersOpen(false)}/>
          </View> : null}
          <View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12}}><T role="caption" tone="tertiary">{shown.length} car{shown.length===1?"":"s"}{filtering?" match your search":" to explore"}</T>{filtering?<Pressable accessibilityRole="button" accessibilityLabel="Clear car filters and search" onPress={()=>{setQuery("");setFuel(null);setBody(null);setBudget("any");}} style={{minHeight:44,justifyContent:"center"}}><T role="caption" tone="accent">Clear all</T></Pressable>:null}</View>
        </View>
      ) : null}
      {error ? <Notice title="Can't load cars" body="Check your connection and try again." action={<Button kind="quiet" label="Retry" onPress={() => setAttempt(n => n+1)}/>} /> : null}
      {!all && !error ? <View style={{ gap: space.line }}><Skeleton height={200} /><Skeleton height={200} /></View> : null}
      {all && all.length === 0 ? <Notice title="No cars listed yet" body="New cars appear here as soon as the studio lists them." /> : null}
      {all && all.length > 0 && shown.length === 0 && filtering ? (
        <Notice title="No cars match" body="Try a wider budget or clear the search." action={<Button kind="quiet" label="Clear filters" onPress={() => { setQuery(""); setFuel(null); setBody(null); setBudget("any"); }} />} />
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.inset }}>
        {shown.map((l) => <Card key={l.id} l={l} onPress={() => router.push(`/(tabs)/cars/${l.id}`)} />)}
      </View>

      {mine.length > 0 ? (
        <View style={{ gap: space.breath }}>
          <Kicker>Your cars for sale</Kicker>
          {mine.map((l) => (
            <Pressable key={l.id} accessibilityRole="button" onPress={() => router.push(`/(tabs)/cars/${l.id}`)} style={{ flexDirection: "row", gap: space.line, alignItems: "center" }}>
              <Image source={{ uri: l.photoUrls[0] }} resizeMode="cover" style={{ width: 72, height: 72, borderRadius: 14 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T role="bodyStrong" numberOfLines={1}>{l.year} {l.make} {l.model}</T>
                <T role="caption" tone="tertiary">{inr(l.askingPrice)}</T>
                {l.status === "rejected" && l.rejectionReason ? <T role="caption" tone="secondary" numberOfLines={2}>{l.rejectionReason}</T> : null}
              </View>
              <Chip label={STATE[l.status] ?? l.status} tone={l.status === "live" ? "accent" : l.status === "rejected" ? "danger" : "neutral"} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <T role="caption" tone="tertiary">AutoDeck lists cars to help buyers and sellers meet. We are not a party to the sale, and ownership papers and transfer are between buyer and seller.</T>
    </Screen>
  );
}
