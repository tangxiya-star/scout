import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { HexclaveProvider, HexclaveTheme } from "@hexclave/next";
import { hexclaveServerApp } from "@/hexclave/server";
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
  title: "Scout — Live Mission",
  description: "Autonomous AI copilot for agricultural drones",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {hexclaveServerApp ? (
          <HexclaveProvider app={hexclaveServerApp}>
            <HexclaveTheme>{children}</HexclaveTheme>
          </HexclaveProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
