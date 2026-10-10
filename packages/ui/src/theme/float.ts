// Floating glass language for the studio app (web). Pure style values.
// Cards float over a soft ground, with a fine edge, big radius and a blurred
// translucent fill. The hero is a studio photo graded to the palette.
export const floatRadius = 34;

export function floatCard(night: boolean) {
  return night
    ? {
        backgroundColor: "rgba(76,76,72,.58)",
        backgroundImage: "linear-gradient(150deg, rgba(255,255,255,.14), rgba(255,255,255,.045))",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.17)",
        borderRadius: floatRadius,
        boxShadow: "0 24px 54px -22px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.22)",
        backdropFilter: "blur(26px) saturate(150%)",
        WebkitBackdropFilter: "blur(26px) saturate(150%)",
      }
    : {
        backgroundColor: "rgba(255,255,255,.60)",
        backgroundImage: "linear-gradient(150deg, rgba(255,255,255,.78), rgba(255,255,255,.40))",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,.85)",
        borderRadius: floatRadius,
        boxShadow: "0 22px 48px -22px rgba(110,70,30,.30), inset 0 1px 0 rgba(255,255,255,.9)",
        backdropFilter: "blur(26px) saturate(150%)",
        WebkitBackdropFilter: "blur(26px) saturate(150%)",
      };
}

export function floatHero(night: boolean, canvas: string) {
  const wash = night
    ? `linear-gradient(180deg, rgba(20,20,18,.10) 0%, rgba(40,40,38,.18) 34%, rgba(54,54,51,.78) 78%, ${canvas} 100%)`
    : `linear-gradient(180deg, rgba(20,16,12,.08) 0%, rgba(251,247,241,.10) 34%, rgba(251,247,241,.76) 78%, ${canvas} 100%)`;
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 560,
    backgroundImage: `${wash}, url(/hero-studio.jpg)`,
    backgroundSize: "cover",
    backgroundPosition: "center 34%",
    backgroundRepeat: "no-repeat",
    pointerEvents: "none",
  } as const;
}

// Full-bleed studio photograph behind every screen, veiled so cards read.
export function floatScene(night: boolean) {
  const veil = night
    ? "linear-gradient(180deg, rgba(40,40,38,.55) 0%, rgba(52,52,49,.78) 50%, rgba(62,62,59,.92) 100%)"
    : "linear-gradient(180deg, rgba(251,247,241,.45) 0%, rgba(251,247,241,.72) 50%, rgba(251,247,241,.90) 100%)";
  return {
    backgroundImage: `${veil}, url(/hero-studio.jpg)`,
    backgroundSize: "cover",
    backgroundPosition: "center 38%",
    backgroundRepeat: "no-repeat",
  } as const;
}
