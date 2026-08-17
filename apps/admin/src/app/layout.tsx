import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AutoDeck Admin",
  description: "AutoDeck studio operations and administration",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
