"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const navItems = [
  { href: "/", label: "Diario" },
  { href: "/watchlist", label: "Por ver" },
  { href: "/listas", label: "Listas" },
  { href: "/titulos/nuevo", label: "Registrar" },
] as const;

export const SiteHeader = () => {
  const currentPath = usePathname();

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
      </div>
    </header>
  );
};
