import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { cn } from "@/lib/utils";
import { AppProviders } from "@/components/providers/AppProviders";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Fi.eri - AI 기반 개인 성장 OS",
  description: "나의 하루, 학습, 성장을 운영해주는 AI 시스템",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Fi.eri',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={cn(
          inter.variable,
          "antialiased bg-background text-foreground min-h-screen font-sans"
        )}
      >
        <AppProviders>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
