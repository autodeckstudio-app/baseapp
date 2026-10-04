import type { Metadata } from "next";
import { Montserrat, Inter, Noto_Sans_Gujarati, Noto_Sans_Devanagari } from "next/font/google";
import { AdminAuthProvider } from "../lib/auth-context";
import { ThemeStyle } from "../experience/ThemeStyle";
import "./globals.css";
import "../experience/experience.css";

// Experience type faces (OFL). Exposed as CSS variables; screens opt in
// through the ax- type classes as they migrate.
const display = Montserrat({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--ad-font-display", display: "swap" });
const body = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ad-font-body", display: "swap" });
const data = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--ad-font-data", display: "swap" });
const gu = Noto_Sans_Gujarati({ subsets: ["gujarati"], weight: ["400", "500", "600"], variable: "--ad-font-gu", display: "swap" });
const hi = Noto_Sans_Devanagari({ subsets: ["devanagari"], weight: ["400", "500", "600"], variable: "--ad-font-hi", display: "swap" });

export const metadata: Metadata = {
  title: "AutoDeck Admin",
  description: "AutoDeck studio operations and administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={`${display.variable} ${body.variable} ${data.variable} ${gu.variable} ${hi.variable}`}>
      <head>
        <ThemeStyle />
      </head>
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
