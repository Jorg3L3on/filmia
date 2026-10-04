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
  <header className="site-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
    <div className={`mx-auto flex h-12 max-w-6xl items-center justify-between gap-3 sm:h-14 sm:gap-4 ${safeAreaInsetXPadClass}`}>
      <Link
        href="/"
        className={focusRing}
        aria-label="Filmia, ir al inicio"
      >
        {/* Wrappers own display so Logo's inline-flex cannot un-hide the unused size. */}
        <span className="inline-flex sm:hidden">
          <Logo size="sm" />
        </span>
        <span className="hidden sm:inline-flex">
          <Logo size="md" />
        </span>
      </Link>
      <SiteHeaderNav user={user} />
    </div>
  </header>
);
