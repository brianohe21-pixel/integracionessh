import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { BrandInitStyles } from "@/components/branding/BrandInitStyles";
import { ThemeInitScript } from "@/components/theme/ThemeInitScript";
import { BRAND_COLOR_STORAGE_KEY } from "@/lib/brand-colors";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChatBot Platform",
  description: "Plataforma SaaS multitenant para agentes con WhatsApp y automatización",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const brandColor = cookieStore.get(BRAND_COLOR_STORAGE_KEY)?.value ?? null;

  return (
    <html lang="es" className={`${geistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <ThemeInitScript />
        <BrandInitStyles primaryColor={brandColor} />
      </head>
      <body className="min-h-full platform-canvas-bg text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
