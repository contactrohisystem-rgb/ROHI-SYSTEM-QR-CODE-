import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// MARÉA prototype: editorial serif for restaurant identity + dish titles.
// Uses a system serif font stack (no network dependency at build time).
// The --font-playfair variable is set in globals.css.
export const metadata: Metadata = {
  title: "MARÉA — Coastal Dining, Maputo",
  description: "MARÉA — coastal dining in Maputo. The Indian Ocean, served differently.",
  authors: [{ name: "ROHI" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
