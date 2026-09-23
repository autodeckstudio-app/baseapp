import type { Metadata } from "next";
import { Outfit, DM_Sans, DM_Mono } from "next/font/google";
import { AdminAuthProvider } from "../lib/auth-context";
import { ThemeStyle } from "../experience/ThemeStyle";
import "./globals.css";
import "../experience/experience.css";

// Experience type faces (OFL). Exposed as CSS variables; screens opt in
// through the ad- type classes as they migrate.
const display = Outfit({ subsets: ["latin"], weight: ["200", "300", "400"], variable: "--ad-font-display", display: "swap" });
const body = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ad-font-body", display: "swap" });
const data = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--ad-font-data", display: "swap" });

export const metadata: Metadata = {
  title: "AutoDeck Admin",
  description: "AutoDeck studio operations and administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${data.variable}`}>
      <head>
        <ThemeStyle />
      </head>
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
