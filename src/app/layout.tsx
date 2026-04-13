import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";
import "leaflet/dist/leaflet.css";
import { Analytics } from "@vercel/analytics/next";

export const metadata = {
  title: "Explrd",
  description: "Track where you've explored, see your travel stats, and share your map.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
