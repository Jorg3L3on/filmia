import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { NavIcon } from "@/components/NavIcon";
import { cn } from "@/lib/cn";
import { focusRing, glassIconClass, safeAreaInsetXPadClass } from "@/lib/ui";

export const SiteHeader = () => (
  <header className="site-header sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
    <div className={`mx-auto flex h-12 max-w-6xl items-center justify-between gap-4 sm:h-14 ${safeAreaInsetXPadClass}`}>
      <Link
        href="/"
        className={focusRing}
        aria-label="Filmia, ir al inicio"
      >
        {/* Wrappers own display so Logo's inline-flex cannot un-hide the unused size. */}
        <span className="inline-flex sm:hidden">
          <Logo size="sm" showMark={false} />
        </span>
        <span className="hidden sm:inline-flex">
          <Logo size="md" showMark={false} />
        </span>
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        {/* Mobile: Buscar moved off the tab bar into the header (dock «+» also has it). */}
        <Link
          href="/buscar"
          aria-label="Buscar"
          className={cn(glassIconClass, "size-9 sm:hidden")}
        >
          <NavIcon name="search" />
        </Link>
        <SiteHeaderNav />
      </div>
    </div>
  </header>
);
