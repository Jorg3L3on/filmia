import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Geist } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { LaunchBoot } from "@/components/launch/LaunchBoot";
import { scheduleAfterResponse } from "@/lib/after-response";
import { ensureDefaultLists } from "@/lib/lists";
import { IOS_SPLASH_IMAGES } from "@/lib/pwa/ios-splash";
import { auth } from "@/lib/session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

/** Filmia canvas — keep in sync with globals.css --canvas, manifest, and splash PNGs. */
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
      { url: "/filmia-mark.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Filmia",
    statusBarStyle: "black-translucent",
    startupImage: IOS_SPLASH_IMAGES,
  },
  // Next emits `mobile-web-app-capable` only. iOS before 16.4 needs the Apple
  // name to honor startup images and the translucent status bar.
  other: {
    "apple-mobile-web-app-capable": "yes",
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
      await ensureDefaultLists(userId);
    });
  }

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="flex min-h-full min-h-[100dvh] flex-col bg-canvas text-paper">
        <LaunchBoot />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
