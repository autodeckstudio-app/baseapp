import { FloatingObject } from "./FloatingObject";
import logoDay from '../../assets/brand/wordmark-light.png';
import logoNight from '../../assets/brand/wordmark-dark.png';
// Screen identity, Help and notifications. Profile lives in bottom navigation.
import { useEffect, useState } from "react";
import { Image,Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useExperienceTheme } from "@autodeck/ui/native";
import { useAuth } from "../hooks/useAuth";
import { listenToMyNotifications } from "../lib/notification-service";
import { raised } from "../lib/raised";
import { NavIcon } from "./NavIcon";

export function AppBar({ title, onBack, textBack=false }: { title: string;textBack?:boolean; onBack?: (() => void) | undefined }) {
  const { colors, name } = useExperienceTheme();
  const r = raised(name);
  const auth = useAuth();
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const ready = auth.status === "ready";
  const owner=ready?`${auth.claims.tenantId}:${auth.user.uid}:${auth.customerDocId??""}`:null;
  useEffect(() => {
    setUnread(0);if (auth.status !== "ready") return;let alive=true;
    const stop=listenToMyNotifications(auth.claims.tenantId, auth.user.uid, (n) => {if(alive)setUnread(n.filter((x) => x.readAt === null).length)}, () => undefined);return()=>{alive=false;stop()};
  }, [owner]);
  const go = (p: string) => () => router.push(p as never);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center", backgroundColor:"transparent" }}>
          <Text style={{color:colors.textPrimary,fontSize:11}}>Back</Text>
        </Pressable>
      ) : (
        <View style={{width:46,height:46}} />
      )}
      <View style={{flex:1,minWidth:0,alignItems:"center",gap:6}}><Image accessibilityLabel="AutoDeck" source={name==="light"?logoDay:logoNight} resizeMode="contain" style={{width:130,maxWidth:"100%",height:19}}/><Text style={{color:colors.textSecondary,fontSize:10}}>{title}</Text></View>
      <View style={{flexDirection:"row",alignItems:"center",gap:8}}><Pressable accessibilityRole="button" accessibilityLabel="Help & contact" onPress={go("/(tabs)/help")} style={{minWidth:44,height:46,alignItems:"center",justifyContent:"center"}}><Text style={{color:colors.textPrimary,fontSize:12}}>Help</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} onPress={go("/(tabs)/notifications")} style={{ width: 46, height: 46, alignItems: "center", justifyContent: "center" }}>
        <FloatingObject name="bell" size={20} />
        {unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
      </Pressable></View>
    </View>
  );
}
