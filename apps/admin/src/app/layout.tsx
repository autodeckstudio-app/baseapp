import type { Metadata } from "next";
import localFont from "next/font/local";
import { AdminAuthProvider } from "../lib/auth-context";
import { ThemeStyle } from "../experience/ThemeStyle";
import "./globals.css";
import "../experience/experience.css";

// Experience type faces (OFL). Exposed as CSS variables; screens opt in
// through the ax- type classes as they migrate.
const display = localFont({ src: "../fonts/montserrat-latin-wght-normal.woff2", weight: "100 900", variable: "--ad-font-display", display: "swap" });
const body = localFont({ src: "../fonts/inter-latin-wght-normal.woff2", weight: "100 900", variable: "--ad-font-body", display: "swap" });
const data = localFont({ src: "../fonts/inter-latin-wght-normal.woff2", weight: "100 900", variable: "--ad-font-data", display: "swap" });
const gu = localFont({ src: "../fonts/noto-sans-gujarati-gujarati-wght-normal.woff2", weight: "100 900", variable: "--ad-font-gu", display: "swap" });
const hi = localFont({ src: "../fonts/noto-sans-devanagari-devanagari-wght-normal.woff2", weight: "100 900", variable: "--ad-font-hi", display: "swap" });

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
