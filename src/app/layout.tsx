import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeOS — Plan. Achieve. Thrive.",
  description:
    "One chat message, one master calendar. Career, studies, competitions, health and personal life organised by an AI planning agent.",
  manifest: "/manifest.json",
  applicationName: "LifeOS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LifeOS",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0716",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LifeOS" />
      </head>
      <body
        className="min-h-dvh antialiased overscroll-none select-none md:select-auto"
        suppressHydrationWarning
      >
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
