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
          {isImmersiveFichaPath(pathname) ? (
            // `contents` keeps the header sticky on desktop; on a phone the ficha owns the top.
            <div className="max-sm:hidden sm:contents">{header}</div>
          ) : (
            header
          )}
          {prefetch}
          <main className={mainClassName}>{children}</main>
          {bottomNav}
        </>
      )}
      {/* One host for auth and app chrome, so a toast's timer survives the swap. */}
      <ToastHost />
    </>
  );
};
