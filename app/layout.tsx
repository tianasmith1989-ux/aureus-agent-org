import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Aureus Plutus — Growth & Marketing Org",
  description: "Autonomous growth & marketing org for Aureus Plutus.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
