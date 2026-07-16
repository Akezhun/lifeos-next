import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "LifeOS 2.0",
  description: "Personal operating system: trackers, journals, schedule, analytics, offline sync and multi-user workspaces.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "LifeOS",
    statusBarStyle: "black-translucent"
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }]
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#7c3aed"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
