import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Geist } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { scheduleAfterResponse } from "@/lib/after-response";
import { ensureDefaultLists } from "@/lib/lists";
import { auth } from "@/lib/session";
import { ensureDefaultTags } from "@/lib/tags";
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
  description: "Diario personal de películas y series.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e1114",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (session?.user?.id) {
    const userId = session.user.id;
    scheduleAfterResponse(async () => {
      await Promise.all([ensureDefaultLists(userId), ensureDefaultTags(userId)]);
    });
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-canvas text-paper">
        <AppShell user={session?.user ?? null}>{children}</AppShell>
      </body>
    </html>
  );
};
