"use client";

import { Geist, Geist_Mono } from "next/font/google";
import { ErrorView } from "@/components/error-view";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Replaces the root layout when it crashes, so it brings its own document, fonts and styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="h-full">
        <title>Something went wrong · Tembak</title>
        <ErrorView error={error} retry={retry} />
      </body>
    </html>
  );
}
