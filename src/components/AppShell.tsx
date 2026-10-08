import { Suspense, type ReactNode } from "react";
import { AppChrome } from "@/components/AppChrome";
import { BottomNav } from "@/components/BottomNav";
import { NavOriginTracker } from "@/components/NavOriginTracker";
import { NavPrefetch } from "@/components/NavPrefetch";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SiteHeader } from "@/components/SiteHeader";

type AppShellProps = {
  children: ReactNode;
};

export const AppShell = ({ children }: AppShellProps) => (
  <AppChrome
    header={<SiteHeader />}
    prefetch={
      <>
        <NavPrefetch />
        <Suspense fallback={null}>
          <NavOriginTracker />
        </Suspense>
        <ServiceWorkerRegister />
      </>
    }
    footer={
      <footer className="hidden border-t border-line px-4 py-5 text-center text-xs text-mist sm:block">
        Filmia · diario personal · sin scrapers
      </footer>
    }
    bottomNav={<BottomNav />}
  >
    {children}
  </AppChrome>
);
