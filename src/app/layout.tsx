import type { Metadata, Viewport } from "next";
import { Newsreader, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// The human voice: questions, answers, the intro. An editorial screen serif with
// an optical-size axis — dramatic at display size, readable in prose; italic for
// quiet emphasis.
const serif = Newsreader({
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-serif",
});

// The machine: stage names, ids, timings, verdicts, all system chrome.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Atlas — cited research answers",
  description:
    "Ask a research question. Atlas retrieves real arXiv papers, answers from what it read, and verifies every citation against the source before showing you anything.",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
