// First-run story before sign-in: what AutoDeck is, what you can do, the brands.
// Paged, skippable, shown once. Images are bundled, so it opens instantly.
/* eslint-disable @typescript-eslint/no-require-imports */
import { useRef, useState } from "react";
import { ScrollView } from "react-native";
import {useExperienceTheme} from "@autodeck/ui/native";
import {Ambient,Button,T} from "./kit";
import { Animated, Image, Platform, Pressable, Text, View, useWindowDimensions, type ImageSourcePropType, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { sceneImagery, serviceImagery } from "../lib/imagery";
import { Fill, Orb, VEIL } from "./Drift";

export const ONBOARDED_KEY = "autodeck.onboarded";

type Slide = { image: ImageSourcePropType; kicker: string; title: string; line: string; chips?: string[] };
const SLIDES: Slide[] = [
  { image: sceneImagery.heroHome, kicker: "AutoDeck", title: "Everything About Your Car, In One App", line: "Book care, track the work, manage bills, papers and warranty - all in one place." },
  { image: serviceImagery.washing, kicker: "Book", title: "Pick a service. Pick a time.", line: "Washing, ceramic coating, paint protection film and more, with open slots you can see." },
  { image: serviceImagery.ceramic, kicker: "Follow", title: "Watch the work happen", line: "Live status, photos and approvals. Pay at the studio when you collect your car." },
  { image: require("../../assets/imagery/brands/xpel-hero.jpg"), kicker: "Brands we fit", title: "Products you can trust", line: "Only the names the industry relies on, with their own warranties.", chips: ["XPEL", "Garware", "Kovalent"] },
  { image: serviceImagery.ppf, kicker: "Everything in one place", title: "Garage, bills and papers", line: "Keep your car records, invoices, warranties and documents together." },
];

export function Onboarding({ onDone }: { onDone: () => void }) {
  const { colors, name } = useExperienceTheme();
  const { width, height } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;
  const finish = () => { void AsyncStorage.setItem(ONBOARDED_KEY, "1").catch(() => undefined); onDone(); };
  const go = (i: number) => {setPage(i);ref.current?.scrollTo({ x: i * width, animated: true });};
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  return <Ambient><View style={{flex:1,paddingTop:24,paddingBottom:24,gap:20}}>
    <View style={{paddingHorizontal:24,flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}><T role="label" tone="tertiary">AUTODECK</T>{!last?<Pressable accessibilityRole="button" accessibilityLabel="Skip" onPress={finish} style={{minHeight:44,justifyContent:"center",paddingHorizontal:12}}><T role="label">Skip</T></Pressable>:null}</View>
    <Animated.ScrollView ref={ref as never} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onEnd} style={{flex:1}}>
      {SLIDES.map((s,i)=><ScrollView key={s.kicker+i} style={{width}} contentContainerStyle={{paddingHorizontal:24,paddingBottom:20,gap:24}}><View style={{height:Math.min(height*.36,300),borderRadius:28,overflow:"hidden"}}><Image source={s.image} resizeMode="cover" style={{width:"100%",height:"100%"}}/></View><View style={{gap:12}}><T role="label" tone="tertiary">{s.kicker}</T><T role="title" style={{fontSize:30,lineHeight:36}}>{s.title}</T><T tone="secondary" style={{lineHeight:24}}>{s.line}</T>{s.chips?<View style={{flexDirection:"row",flexWrap:"wrap",gap:8}}>{s.chips.map(c=><View key={c} style={{paddingHorizontal:14,paddingVertical:9,borderRadius:12,borderWidth:1,borderColor:colors.borderSubtle}}><T role="caption">{c}</T></View>)}</View>:null}</View></ScrollView>)}
    </Animated.ScrollView>
    <View style={{paddingHorizontal:24,gap:20}}><View style={{flexDirection:"row",gap:7}}>{SLIDES.map((_,i)=><Pressable key={i} accessibilityRole="button" accessibilityLabel={`Go to introduction ${i+1}`} onPress={()=>go(i)} style={{minHeight:32,flex:1,justifyContent:"center"}}><View style={{height:4,borderRadius:4,backgroundColor:i===page?colors.textPrimary:colors.borderSubtle}}/></Pressable>)}</View><Button label={last?"Get started":"Next"} onPress={()=>last?finish():go(page+1)}/></View>
  </View></Ambient>;
}
