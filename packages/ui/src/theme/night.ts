// One night material system for all three apps. Coal Mine remains the anchor.
// Opaque fallbacks keep text readable on native and without backdrop blur.
export const nightGround = "radial-gradient(ellipse at 12% 0%, rgba(220,218,204,.09), transparent 52%), radial-gradient(ellipse at 100% 40%, rgba(236,134,56,.05), transparent 55%), linear-gradient(155deg, #60605B 0%, #555550 38%, #50504D 68%, #444441 100%)";
export const nightSurface = "linear-gradient(145deg, rgba(87,87,82,.96), rgba(65,65,62,.94))";
// One orange layer, with a white reflection confined to the top rim.
// The centre stays clear so the charcoal underneath is visible through it.
export const nightOrange = "linear-gradient(180deg, rgba(255,255,255,.20) 0%, rgba(255,255,255,.045) 14%, rgba(255,255,255,0) 42%), linear-gradient(150deg, rgba(245,154,78,.22), rgba(236,134,56,.20) 55%, rgba(236,134,56,.18))";
// Night main button: solid white with dark text (60-30-10, owner pick 18 Oct 2026). Orange is for the active nav only.
export const nightButtonText = "#1A1410";
export const nightButtonStyle = {
  backgroundColor: "#FFFFFF", backgroundImage: "none",
  borderWidth: 0,
  boxShadow: "0 4px 14px rgba(0,0,0,.28)",
};
export const nightGroundStyle = { backgroundImage: nightGround, backgroundAttachment: "fixed" };
export const nightSurfaceStyle = { backgroundImage: nightSurface, borderWidth: 1, borderColor: "rgba(255,255,255,.18)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.12), 0 6px 20px rgba(0,0,0,.12)" };
