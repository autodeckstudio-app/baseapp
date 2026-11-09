import { IconAction } from "./IconAction";
import { useEffect, useState } from "react";
// Profile identity card: one glass card, same language as Home. Name, email, one Edit action. No tiles.
import { Image, Text, View } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { metrics } from "../lib/metrics";

export function ProfileHero({ name, email, photoUrl, onEdit }: { name: string; photoUrl?: string | null | undefined; email?: string | null | undefined; onEdit: () => void }) {
  const { name: themeName, colors } = useExperienceTheme();
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[photoUrl]);
  const light = themeName === "light";
  const stacked=name.length>20||(email?.length??0)>26;
  const identity=<View style={{flex:1,minWidth:0,gap:2}}><Text style={{color:colors.textPrimary,fontSize:19,fontWeight:"800"}}>{name}</Text>{email?<Text style={{color:colors.textSecondary,fontSize:13}}>{email}</Text>:null}</View>;
  return (
    <View style={{gap:14,padding:metrics.cardPad,...glassPane(light)}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:14}}>
      <View style={{ overflow:"hidden", width: 60, height: 60, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: light ? "#16181C" : "#B9A58C" }}>
        {photoUrl&&!failed?<Image accessibilityLabel="Your Google profile photo" source={{uri:photoUrl}} onError={()=>setFailed(true)} style={{width:60,height:60}}/>:<Text style={{ color: light ? "#F4F1EC" : "#16181C", fontSize: 24, fontWeight: "800" }}>{(name.trim()[0] ?? "A").toUpperCase()}</Text>}
      </View>
      {stacked?<View style={{flex:1}}/>:identity}
      <IconAction kind="edit" label="Edit name" onPress={onEdit} />
    </View>
    {stacked?identity:null}
    </View>
  );
}
