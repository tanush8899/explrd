import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";
import Script from "next/script";
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "Explr",
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
        <Script src="/_vercel/insights/script.js" strategy="afterInteractive" />
      </body>
    </html>
  );
}
