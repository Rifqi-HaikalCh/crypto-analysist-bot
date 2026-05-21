import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Crypto Scalping Assistant — AI-Powered 24/7 Alert System",
  description:
    "Asisten trading crypto scalping otonom dengan pemantauan harga real-time, notifikasi Telegram otomatis saat target profit 5% tercapai, dan analisis AI berbasis Gemini.",
  keywords: [
    "crypto",
    "scalping",
    "trading",
    "binance",
    "bitcoin",
    "AI analysis",
    "telegram alert",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-grid-pattern bg-radial-glow">
        {children}
      </body>
    </html>
  );
}
