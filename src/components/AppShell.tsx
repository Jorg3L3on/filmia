"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BottomNav } from "@/components/BottomNav";
import { SiteHeaderClient } from "@/components/SiteHeaderClient";

const AUTH_PATHS = ["/login", "/registro"];

type AppShellProps = {
  children: ReactNode;
};

export const AppShell = ({ children }: AppShellProps) => {
  const pathname = usePathname();
  const isAuthPage = AUTH_PATHS.some((path) => pathname === path);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <>
      <SiteHeaderClient />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-24 pt-6 sm:pb-10 sm:pt-8">
        {children}
      </main>
      <footer className="hidden border-t border-line px-4 py-5 text-center text-xs text-mist sm:block">
        Filmia · diario personal · sin scrapers
      </footer>
      <BottomNav />
    </>
  );
};
