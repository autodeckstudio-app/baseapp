import { ProfilePhotoPicker } from "./ProfilePhotoPicker";
import { useEffect, useState } from "react";
// Profile identity card: one glass card, same language as Home. Name, email, one Edit action. No tiles.
import { Image, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useExperienceTheme } from "@autodeck/ui/native";
import { glassPane } from "../lib/glass-pane";
import { metrics } from "../lib/metrics";

export function ProfileHero({ name, email, photoUrl, photoScope, onEdit }: { name: string; photoScope?: string; photoUrl?: string | null | undefined; email?: string | null | undefined; onEdit: () => void }) {
  const { name: themeName, colors } = useExperienceTheme();
  const [failed,setFailed]=useState(false);
  useEffect(()=>setFailed(false),[photoUrl]);
  const light = themeName === "light";
  const {width}=useWindowDimensions();
  const stacked=width<360||name.length>20||(email?.length??0)>26;
  const identity=<View style={{flex:1,minWidth:0,gap:metrics.identityGap}}><Text style={{color:colors.textPrimary,fontSize:19,fontWeight:"800"}}>{name}</Text>{email?<Text style={{color:colors.textSecondary,fontSize:13}}>{email}</Text>:null}</View>;
  return (
    <View style={{gap:18,padding:22,...glassPane(light)}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:14}}>
      <View style={{width:72,height:72}}><View style={{ overflow:"hidden", width: 72, height: 72, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: light ? "#16181C" : colors.textPrimary }}>
        {photoUrl&&!failed?<Image accessibilityLabel="Your Google profile photo" source={{uri:photoUrl}} onError={()=>setFailed(true)} style={{width:72,height:72}}/>:<Text style={{ color: light ? "#F4F1EC" : "#16181C", fontSize: 24, fontWeight: "800" }}>{(name.trim()[0] ?? "A").toUpperCase()}</Text>}
      </View><ProfilePhotoPicker scope={photoScope ?? JSON.stringify([name,email,photoUrl])}/></View>
      {stacked?<View style={{flex:1}}/>:identity}
      <Pressable accessibilityRole="button" accessibilityLabel="Edit name" onPress={onEdit} style={({pressed}) => ({minHeight:44,paddingHorizontal:12,alignItems:"center",justifyContent:"center",borderRadius:14,borderWidth:1,borderColor:colors.borderSubtle,opacity:pressed?0.7:1})}><Text style={{color:colors.textPrimary,fontSize:13,fontWeight:"700"}}>Edit</Text></Pressable>
    </View>
    {stacked?identity:null}
    </View>
  );
}
