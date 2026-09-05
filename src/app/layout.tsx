import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { auth } from "@/lib/session";
import { ensureDefaultLists } from "@/lib/lists";
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
  description: "Diario personal de películas y series. Letterboxd casero.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#14181c",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const session = await auth();

  if (session?.user?.id) {
    await Promise.all([
      ensureDefaultLists(session.user.id),
      ensureDefaultTags(session.user.id),
    ]);
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
