"use client";

import Link from "next/link";
import { Logo } from "@/components/Logo";
import { LogoutButton } from "@/components/LogoutButton";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const navItems = [
  { href: "/", label: "Diario" },
  { href: "/watchlist", label: "Quiero ver" },
  { href: "/listas", label: "Listas" },
  { href: "/tags", label: "Etiquetas" },
  { href: "/buscar", label: "Buscar" },
  { href: "/perfil", label: "Perfil" },
] as const;

export type HeaderUser = {
  name?: string | null;
  email?: string | null;
} | null;

type SiteHeaderProps = {
  pathname: string;
  user: HeaderUser;
};

export const SiteHeader = ({ pathname: currentPath, user }: SiteHeaderProps) => {
  const displayName = user?.name ?? user?.email ?? "Cuenta";

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          href="/"
          className={focusRing}
          aria-label="Filmia, ir al inicio"
        >
          <Logo size="md" />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 text-sm sm:flex">
          {navItems.map((item) => {
            const isCurrent =
              item.href === "/"
                ? currentPath === "/"
                : currentPath.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "rounded-full px-3 py-1.5 transition",
                  focusRing,
                  isCurrent
                    ? "bg-accent font-medium text-ink"
                    : "text-fog hover:bg-chrome hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/perfil"
            title={displayName}
            aria-label={`Perfil de ${displayName}`}
            aria-current={currentPath.startsWith("/perfil") ? "page" : undefined}
            className={cn(
              "max-w-[8rem] truncate rounded-full px-3 py-1.5 text-xs transition sm:max-w-[10rem]",
              focusRing,
              currentPath.startsWith("/perfil")
                ? "bg-accent font-medium text-ink"
                : "text-mist hover:bg-chrome hover:text-white",
            )}
          >
            {user?.name?.trim() || "Perfil"}
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
};
