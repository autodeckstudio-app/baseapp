import { View } from "react-native";

/** Real studio photo from the brand set, faded into the page so the glass panes have something to blur. */
export const HOME_BACKDROP_PHOTO = "/hero-studio.jpg";

export function HomeBackdrop() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: -140, left: -20, right: -20, height: 520, overflow: "hidden", zIndex: -1 }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: `url(${HOME_BACKDROP_PHOTO})`, backgroundSize: "cover", backgroundPosition: "center" } as object) }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.78) 55%, #0b0b0d 100%)" } as object) }} />
    </View>
  );
}
