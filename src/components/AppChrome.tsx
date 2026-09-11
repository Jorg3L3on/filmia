"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ToastHost } from "@/components/ToastHost";
import { isAuthChromePath } from "@/lib/nav";

type AppChromeProps = {
  header: ReactNode;
  prefetch: ReactNode;
  footer: ReactNode;
  bottomNav: ReactNode;
  children: ReactNode;
};

export const AppChrome = ({
  header,
  prefetch,
  footer,
  bottomNav,
  children,
}: AppChromeProps) => {
  const pathname = usePathname();

  if (isAuthChromePath(pathname)) {
    return (
      <>
        {children}
        <ToastHost />
      </>
    );
  }

  return (
    <>
      {header}
      {prefetch}
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-[max(6rem,calc(5.5rem+env(safe-area-inset-bottom)))] pt-6 sm:pb-10 sm:pt-8">
        {children}
      </main>
      {footer}
      {bottomNav}
      <ToastHost />
    </>
  );
};
