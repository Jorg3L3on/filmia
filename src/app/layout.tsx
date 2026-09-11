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

/** Filmia canvas (~#0e1114) — keep in sync with globals.css --canvas and manifest. */
const THEME_COLOR = "#0e1114";

export const metadata: Metadata = {
  applicationName: "Filmia",
  title: {
    default: "Filmia",
    template: "%s · Filmia",
  },
  description: "Diario personal de películas y series.",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/logo.png", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Filmia",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  viewportFit: "cover",
  /** Keep fixed BottomNav stable when the iOS keyboard opens (JOR-218). */
  interactiveWidget: "overlays-content",
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
      <body className="flex min-h-full min-h-[100dvh] flex-col bg-canvas text-paper">
        <AppShell user={session?.user ?? null}>{children}</AppShell>
      </body>
    </html>
  );
}
