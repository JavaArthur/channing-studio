import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { GlobalShortcuts } from "@/components/GlobalShortcuts";
import { ToastProvider } from "@/components/Toast";
import { COLOR_MODE_SCRIPT } from "@/lib/appearance";
import { getSiteUrl, getSiteUrlObject } from "@/lib/site-config";

const geistSans = localFont({
  src: [
    { path: "./fonts/geist/Geist-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist/Geist-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist/Geist-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/geist/Geist-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-sans",
  display: "swap",
  fallback: ["system-ui", "Arial", "Helvetica", "sans-serif"],
});

const geistMono = localFont({
  src: [
    { path: "./fonts/geist/GeistMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist/GeistMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist/GeistMono-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/geist/GeistMono-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-geist-mono",
  display: "swap",
  fallback: ["SFMono-Regular", "Consolas", "Monaco", "monospace"],
});

const SITE_URL = getSiteUrl()

export const metadata: Metadata = {
  metadataBase: getSiteUrlObject(),
  title: {
    default: 'Channing Studio · 晨启AI',
    template: '%s · Channing Studio',
  },
  description: 'AI 平台工程、内容自动化与真实交付的公开工作台。',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  alternates: {
    types: {
      'application/rss+xml': '/feed.xml',
    },
  },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: SITE_URL,
    siteName: 'Channing Studio',
    title: 'Channing Studio · 晨启AI',
    description: 'AI 平台工程、内容自动化与真实交付的公开工作台。',
    images: [
      {
        url: '/icon-512.png',
        width: 512,
        height: 512,
        alt: 'Channing Studio',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'Channing Studio · 晨启AI',
    description: 'AI 平台工程、内容自动化与真实交付的公开工作台。',
    images: ['/icon-512.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: COLOR_MODE_SCRIPT }} /></head>
      <body className="min-h-full flex flex-col"><ToastProvider><GlobalShortcuts />{children}</ToastProvider></body>
    </html>
  )
}
