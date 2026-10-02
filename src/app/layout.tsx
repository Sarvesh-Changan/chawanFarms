import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/config/env";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chawan Farms",
  description: "Chawan Farms project scaffold",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
