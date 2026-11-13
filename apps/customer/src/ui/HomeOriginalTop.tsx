import wordmark from '../../assets/brand/wordmark-dark.png';
import {Image,Platform,Pressable,Text,View,useWindowDimensions} from 'react-native';
import {useExperienceTheme} from '@autodeck/ui/native';
import {KenBurns,Rise} from './Drift';
import {NavIcon} from './NavIcon';
import {CarChips} from './CarChips';
import {textStyle} from './kit';
import {sceneImagery} from '../lib/imagery';
import {metrics} from '../lib/metrics';
import type {HomeViewProps} from './HomeView';
/** Original photo header, full-size story tray and car card. The adapter owns the active car. */
export function HomeOriginalTop({p,onMenu}:{p:HomeViewProps;onMenu:()=>void}){
const {name}=useExperienceTheme();const {width}=useWindowDimensions();const gutter=width<360?16:20;
const heroHeight=width<380?192:width<600?200:208;
const setMenu=(_open:boolean)=>onMenu();
return <View testID='home-original-top' style={{gap:metrics.sectionGap}}>
      <View style={{ marginHorizontal: -gutter, marginTop: -16 }}>
        <View style={{ height: heroHeight, overflow: "hidden", borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
          <KenBurns source={sceneImagery.heroHome} />
          {Platform.OS === "web" ? (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, ...({ backgroundImage: `linear-gradient(180deg, rgba(8,9,10,0.34) 0%, rgba(8,9,10,0.08) 34%, rgba(8,9,10,0.52) 58%, rgba(8,9,10,0.58) 92%, ${name === "night" ? "rgba(36,38,42,1)" : "rgba(255,255,255,1)"} 100%)` } as object) }} />
          ) : (
            <>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(8,9,10,0.2)" }} />
              <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", backgroundColor: "rgba(8,9,10,0.42)" }} />
            </>
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: gutter, paddingTop: 16 }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => (p.drawer?.length ? setMenu(true) : p.onAvatar())} style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,11,13,0.38)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", opacity: pressed ? 0.85 : 1, ...(Platform.OS === "web" ? ({ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as object) : {}) })}>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>{p.initial}</Text>
            </Pressable>
            <Image testID="home-official-wordmark" accessibilityLabel="AutoDeck" source={wordmark} resizeMode="contain" style={{width:164,maxWidth:'52%',height:22}} />
            <Pressable accessibilityRole="button" accessibilityLabel={p.unread > 0 ? `Notifications, ${p.unread} unread` : "Notifications"} onPress={p.onBell} style={({ pressed }) => ({ width: 46, height: 46, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(10,11,13,0.38)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)", opacity: pressed ? 0.85 : 1, ...(Platform.OS === "web" ? ({ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" } as object) : {}) })}>
              <NavIcon name="bell" color="#FFFFFF" size={22} cut="#18181C" />
              {p.unread > 0 ? <View style={{ position: "absolute", top: 11, right: 12, width: 9, height: 9, borderRadius: 5, backgroundColor: "#EC8638" }} /> : null}
            </Pressable>
          </View>
          <Rise delay={60} style={{ position: "absolute", left: 20, right: 20, bottom: 20, gap: 6 }}>
            <Text testID="home-greeting" numberOfLines={1} style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" }}>{p.greeting}</Text>
            <Text style={[textStyle("display"), { fontSize: width < 380 ? 26 : 30, lineHeight: width < 380 ? 30 : 34, color: "#FFFFFF", letterSpacing: -0.8 }]}>{"Complete car care.\nAll under one roof."}</Text>
          </Rise>
        </View>
      </View>

{p.stories}
<CarChips cars={p.cars.slice(0,1)} active={0} onActive={()=>p.onGarage()} onOpen={p.onCar} onAdd={p.onAddCar}/>
{p.cars.length>1?<Pressable accessibilityRole='button' accessibilityLabel='Switch car' onPress={p.onGarage} style={{minHeight:44,alignSelf:'flex-end',justifyContent:'center'}}><Text style={{...textStyle('caption'),color:'#A96C38'}}>Switch car</Text></Pressable>:null}
</View>;
}
