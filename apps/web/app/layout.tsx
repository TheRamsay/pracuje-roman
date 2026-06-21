import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pracuje Roman?",
  description: "Dashboard pro sledování Romanovy aktivity a WoW session."
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
