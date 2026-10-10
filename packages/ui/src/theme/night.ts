// One night material system for all three apps. Coal Mine remains the anchor.
// Opaque fallbacks keep text readable on native and without backdrop blur.
export const nightGround = "radial-gradient(ellipse at 12% 0%, rgba(220,218,204,.09), transparent 52%), radial-gradient(ellipse at 100% 40%, rgba(236,134,56,.05), transparent 55%), linear-gradient(155deg, #60605B 0%, #555550 38%, #50504D 68%, #444441 100%)";
export const nightSurface = "linear-gradient(145deg, rgba(87,87,82,.96), rgba(65,65,62,.94))";
export const nightOrange = "linear-gradient(150deg, rgba(245,154,78,.88), rgba(236,134,56,.82) 55%, rgba(236,134,56,.80))";
export const nightButtonStyle = {
  backgroundColor: "transparent", backgroundImage: nightOrange,
  backdropFilter: "blur(18px) saturate(125%)", WebkitBackdropFilter: "blur(18px) saturate(125%)",
  borderWidth: 1, borderColor: "rgba(255,202,155,.55)",
  boxShadow: "inset 0 1px 0 rgba(255,236,214,.38), 0 5px 16px rgba(0,0,0,.14)",
};
export const nightGroundStyle = { backgroundImage: nightGround, backgroundAttachment: "fixed" };
export const nightSurfaceStyle = { backgroundImage: nightSurface, borderWidth: 1, borderColor: "rgba(255,255,255,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), 0 6px 20px rgba(0,0,0,.12)" };
