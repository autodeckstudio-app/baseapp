// Floating glass language for the studio app (web). Pure style values.
// Cards float over a soft ground, with a fine edge, big radius and a blurred
// translucent fill. The hero is a studio photo graded to the palette.
export const floatRadius = 28;

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
    ? `linear-gradient(180deg, rgba(60,60,57,.34) 0%, rgba(70,70,67,.74) 55%, ${canvas} 100%)`
    : `linear-gradient(180deg, rgba(250,246,240,.50) 0%, rgba(250,246,240,.80) 55%, ${canvas} 100%)`;
  return {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 460,
    backgroundImage: `${wash}, linear-gradient(110deg, rgba(236,134,56,${night ? ".28" : ".18"}), rgba(236,134,56,0) 62%), url(/hero-studio.jpg)`,
    backgroundSize: "cover",
    backgroundPosition: "center 32%",
    backgroundRepeat: "no-repeat",
    WebkitMaskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
    maskImage: "linear-gradient(180deg, #000 55%, transparent 100%)",
    pointerEvents: "none",
  } as const;
}
