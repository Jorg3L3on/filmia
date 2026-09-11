import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { focusRing, safeAreaInsetXPadClass } from "@/lib/ui";

export type HeaderUser = {
  name?: string | null;
  email?: string | null;
} | null;

type SiteHeaderProps = {
  user: HeaderUser;
};

export const SiteHeader = ({ user }: SiteHeaderProps) => (
  <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 pt-[env(safe-area-inset-top)] backdrop-blur">
    <div className={`mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 sm:h-14 sm:gap-4 ${safeAreaInsetXPadClass}`}>
      <Link
        href="/"
        className={focusRing}
        aria-label="Filmia, ir al inicio"
      >
        <Logo size="sm" className="sm:hidden" />
        <Logo size="md" className="hidden sm:inline-flex" />
      </Link>
      <SiteHeaderNav user={user} />
    </div>
  </header>
);
