"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ToastHost } from "@/components/ToastHost";
import { isAuthChromePath, isImmersiveFichaPath } from "@/lib/nav";

type AuthChromeGateProps = {
  header: ReactNode;
  prefetch: ReactNode;
  bottomNav: ReactNode;
  mainClassName: string;
  children: ReactNode;
};

/** Tiny client leaf: hide app chrome on /login|/registro|/bienvenida (incl. auth-path 404s). */
export const AuthChromeGate = ({
  header,
  prefetch,
  bottomNav,
  mainClassName,
  children,
}: AuthChromeGateProps) => {
  const pathname = usePathname();

  return (
    <>
      {isAuthChromePath(pathname) ? (
        children
      ) : (
        <>
          {/* First Tab stop on every app page (UX-19, WCAG 2.4.1): straight to the content. */}
          <a
            href="#contenido"
            className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
          >
            Saltar al contenido
          </a>
          {isImmersiveFichaPath(pathname) ? (
            // `contents` keeps the header sticky on desktop; on a phone the ficha owns the top.
            <div className="max-sm:hidden sm:contents">{header}</div>
          ) : (
            header
          )}
          {prefetch}
          <main id="contenido" tabIndex={-1} className={mainClassName}>
            {children}
          </main>
          {bottomNav}
        </>
      )}
      {/* One host for auth and app chrome, so a toast's timer survives the swap. */}
      <ToastHost />
    </>
  );
};
