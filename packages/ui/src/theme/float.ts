// Floating glass language for the studio app (web). Pure style values.
// Cards float over a soft ground, with a fine edge, big radius and a blurred
// translucent fill. The hero is a studio photo graded to the palette.
export const floatRadius = 28;

export function floatCard(night: boolean) {
  return night
    ? {
        backgroundColor: "rgba(22,22,24,.80)",
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

/** The page light: brand orange from the top edge, low opacity, fading to nothing. Replaces the studio photo behind pages. */
export const LAMP_GLOW = "radial-gradient(90vmax 46vmax at 50% 0%, rgba(236,134,56,0.16), rgba(236,134,56,0) 70%)";

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
    backgroundImage: `${LAMP_GLOW}, ${wash}`,
    pointerEvents: "none",
  } as const;
}

// Soft orange lamp light behind every screen, veiled so cards read.
export function floatScene(night: boolean) {
  const veil = night
    ? "linear-gradient(180deg, rgba(28,28,28,.72) 0%, rgba(34,34,34,.86) 50%, rgba(40,40,40,.94) 100%)"
    : "linear-gradient(180deg, rgba(251,247,241,.45) 0%, rgba(251,247,241,.72) 50%, rgba(251,247,241,.90) 100%)";
  return {
    backgroundImage: `${LAMP_GLOW}, ${veil}`,
  } as const;
}
