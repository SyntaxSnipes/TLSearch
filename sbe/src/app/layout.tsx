// src/app/layout.tsx
import "./globals.css";
import VantaBackground from "./components/VantaBackground";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500", "600", "700", "800"],
  variable: "--font-plusjakarta",
});

import type { Metadata } from "next";
import { GoogleAnalytics } from "@next/third-parties/google";

export const metadata: Metadata = {
  title: "TLSearch",
  description: "Space Biology Engine Search",
  icons: {
    icon: [
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", type: "image/x-icon" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: {
    title: "TLSearch",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} relative min-h-screen text-white`}>
        <VantaBackground />
        <div className="fixed inset-0 bg-[#000]/85 pointer-events-none -z-10" />
        {children}
      </body>
      <GoogleAnalytics gaId="G-2XC2YVMQV8" />
    </html>
  );
}
