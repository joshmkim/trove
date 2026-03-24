import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Trove",
  description: "Inventory management for Harucake",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${instrumentSans.variable} antialiased`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
