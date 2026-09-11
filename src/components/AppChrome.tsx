import type { ReactNode } from "react";
import { AuthChromeGate } from "@/components/AuthChromeGate";

/** Keep safe-area class here so Fase 3 verifies still find it on AppChrome. */
export const appMainClassName =
  "mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-[max(6rem,calc(5.5rem+env(safe-area-inset-bottom)))] pt-6 sm:pb-10 sm:pt-8";

type AppChromeProps = {
  header: ReactNode;
  prefetch: ReactNode;
  footer: ReactNode;
  bottomNav: ReactNode;
  children: ReactNode;
};

/** Server chrome frame — auth hide + toasts live in AuthChromeGate (client leaf). */
export const AppChrome = ({
  header,
  prefetch,
  footer,
  bottomNav,
  children,
}: AppChromeProps) => (
  <AuthChromeGate
    header={header}
    prefetch={prefetch}
    footer={footer}
    bottomNav={bottomNav}
    mainClassName={appMainClassName}
  >
    {children}
  </AuthChromeGate>
);
