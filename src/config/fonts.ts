import { Fraunces, Inter, Noto_Sans_Devanagari } from "next/font/google";

export const displayFont = Fraunces({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
});

export const uiFont = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-ui",
});

export const devanagariFont = Noto_Sans_Devanagari({
  display: "swap",
  subsets: ["devanagari", "latin"],
  variable: "--font-deva",
});
