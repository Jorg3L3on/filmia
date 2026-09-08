import type { ReactNode } from "react";
import { AppChrome } from "@/components/AppChrome";
import { BottomNav } from "@/components/BottomNav";
import { NavPrefetch } from "@/components/NavPrefetch";
import { SiteHeader, type HeaderUser } from "@/components/SiteHeader";

export type { HeaderUser };

type AppShellProps = {
  children: ReactNode;
  user: HeaderUser;
};

export const AppShell = ({ children, user }: AppShellProps) => (
  <AppChrome
    header={<SiteHeader user={user} />}
    prefetch={<NavPrefetch />}
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
