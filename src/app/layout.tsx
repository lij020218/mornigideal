import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "A.ideal - AI 기반 개인 성장 OS",
  description: "나의 하루, 학습, 성장을 운영해주는 AI 시스템",
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
        {children}
      </body>
    </html>
  );
}
