// One login design for customer, studio and admin. Only role, title and copy change per app.
export const AUTH = {
  ground: "linear-gradient(135deg, #D3D8F5 0%, #EEEBF8 48%, #F8E4D9 100%)",
  groundFallback: "#EEEBF8",
  maxWidth: 400,
  cardRadius: 28,
  cardPad: 28,
  cardBg: "rgba(255,255,255,0.94)",
  cardBorder: "rgba(29,27,38,0.06)",
  cardShadow: "0 18px 50px rgba(60,40,90,0.16)",
  logoHeight: 92,
  text: "#1D1B26",
  muted: "#5E5A6B",
  accent: "#C4550A",
  buttonHeight: 52,
  buttonRadius: 26,
  danger: "#B42318",
} as const;

export const AUTH_FOOTNOTE = "Google sign-in only. We never ask for a password.";
