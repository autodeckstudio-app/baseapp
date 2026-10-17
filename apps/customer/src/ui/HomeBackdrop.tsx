import { View } from "react-native";

/** Real studio photo from the brand set, faded into the page so the glass panes have something to blur. */
export const HOME_BACKDROP_PHOTO = "/hero-studio.jpg";

export const BACKDROP_FADE = "linear-gradient(180deg, #000 0%, #000 38%, rgba(0,0,0,0.6) 62%, rgba(0,0,0,0.25) 82%, transparent 100%)";

// One fixed layer from the very top of the screen (under the status bar, in the PWA too), so there is no band and no hard
// photo edge. The photo dissolves into the page ground with a long mask in Day and Night alike.
export function HomeBackdrop() {
  const fade = { maskImage: BACKDROP_FADE, WebkitMaskImage: BACKDROP_FADE } as object;
  return (
    <View pointerEvents="none" style={{ ...({ position: "fixed" } as object), top: 0, left: 0, right: 0, height: 480, overflow: "hidden", zIndex: -1, ...fade }}>
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: `url(${HOME_BACKDROP_PHOTO})`, backgroundSize: "cover", backgroundPosition: "center top" } as object) }} />
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, ...({ backgroundImage: "linear-gradient(180deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.72) 45%, rgba(10,10,12,0.8) 100%)" } as object) }} />
    </View>
  );
}
