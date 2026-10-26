import type { Metadata } from "next";
import { Cormorant_Garamond, Tangerine, Jost } from "next/font/google";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
});

const script = Tangerine({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "GORDAYA | nails & lashes — онлайн запис",
  description:
    "Манікюр та нарощування вій. Онлайн-запис на зручний час — GORDAYA nails & lashes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${cormorant.variable} ${script.variable} ${jost.variable} antialiased`}
      >
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
