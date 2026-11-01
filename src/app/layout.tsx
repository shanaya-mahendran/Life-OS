import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LifeOS — Plan. Achieve. Thrive.",
  description:
    "One chat message, one master calendar. Career, studies, competitions, health and personal life organised by an AI planning agent.",
  applicationName: "LifeOS",
};

export const viewport: Viewport = {
  themeColor: "#06040e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
