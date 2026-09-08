import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SiteHeaderNav } from "@/components/SiteHeaderNav";
import { focusRing } from "@/lib/ui";

export type HeaderUser = {
  name?: string | null;
  email?: string | null;
} | null;

type SiteHeaderProps = {
  user: HeaderUser;
};

export const SiteHeader = ({ user }: SiteHeaderProps) => (
  <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:gap-4 sm:py-3">
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
