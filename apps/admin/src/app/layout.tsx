import type { Metadata } from "next";
import { AdminAuthProvider } from "../lib/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoDeck Admin",
  description: "AutoDeck studio operations and administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
