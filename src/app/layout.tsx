import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { BottomNav } from "@/components/BottomNav";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Filmia",
    template: "%s · Filmia",
  },
  description: "Diario personal de películas y series. Letterboxd casero.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#14181c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-paper">
        <SiteHeader />
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-6 sm:pb-10 sm:pt-8">
          {children}
        </main>
        <footer className="hidden border-t border-line px-4 py-5 text-center text-xs text-mist sm:block">
          Filmia · diario personal · sin scrapers
        </footer>
        <BottomNav />
      </body>
    </html>
  );
};
