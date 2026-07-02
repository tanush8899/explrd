import "./globals.css";
import type { ReactNode } from "react";
import type { Viewport } from "next";
import Script from "next/script";
import "leaflet/dist/leaflet.css";

export const metadata = {
  title: "EXPLRD — Track where you've explored",
  description: "Track every place you've explored, see your travel stats, and share your map with friends. Now on the App Store.",
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
