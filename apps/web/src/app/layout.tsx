import type { Metadata, Viewport } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";

import { AppShell } from "@/components/app-shell";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";

import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "LnFTI",
  title: {
    default: "LnFTI — Untar Lost & Found",
    template: "%s | LnFTI",
  },
  description:
    "Platform laporan barang hilang dan temuan untuk lingkungan Universitas Tarumanagara.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/lnfti-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/lnfti-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "LnFTI",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#6B1220",
  colorScheme: "light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body className={`${plusJakarta.variable} ${dmSans.variable} antialiased`}>
        <AppShell>{children}</AppShell>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
