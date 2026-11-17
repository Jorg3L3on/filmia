import { Suspense, type ReactNode } from "react";
import { AppChrome } from "@/components/AppChrome";
import { BottomNav } from "@/components/BottomNav";
import { NavOriginTracker } from "@/components/NavOriginTracker";
import { NavPrefetch } from "@/components/NavPrefetch";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SiteHeader } from "@/components/SiteHeader";
import { profileInitial } from "@/lib/profile-initial";
import { auth } from "@/lib/session";

type AppShellProps = {
  children: ReactNode;
};

export const AppShell = async ({ children }: AppShellProps) => {
  // Perfil's avatar (FIL-I60-1) needs only the initial; the session cookie already carries it.
  const user = (await auth())?.user;
  const initial = user ? profileInitial(user.name, user.email) : null;
  return (
  <AppChrome
    header={<SiteHeader initial={initial} />}
    prefetch={
      <>
        <NavPrefetch />
        <Suspense fallback={null}>
          <NavOriginTracker />
        </Suspense>
        <ServiceWorkerRegister />
      </>
    }
    bottomNav={<BottomNav initial={initial} />}
  >
    {children}
  </AppChrome>
  );
};
