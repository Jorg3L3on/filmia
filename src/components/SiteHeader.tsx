"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";

const navItems = [
  { href: "/", label: "Diario" },
  { href: "/watchlist", label: "Por ver" },
  { href: "/listas", label: "Listas" },
  { href: "/titulos/nuevo", label: "Nuevo título" },
] as const;

export const SiteHeader = () => {
  const currentPath = usePathname();

  return (
    <header className="border-b border-[#2c3440] bg-[#0a0a0a]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <Link
          href="/"
          className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b5cf6]"
          aria-label="Filmia, ir al inicio"
        >
          <Logo size="md" />
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-1.5 text-sm sm:gap-2">
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
                className={
                  isCurrent
                    ? item.href === "/watchlist"
                      ? "rounded-full bg-gradient-to-r from-[#2563eb] via-[#7c3aed] to-[#db2777] px-2.5 py-1.5 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3"
                      : "rounded-full bg-[#00e054] px-2.5 py-1.5 font-medium text-[#14181c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:px-3"
                    : "rounded-full px-2.5 py-1.5 text-[#99aabb] hover:bg-[#2c3440] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8b5cf6] sm:px-3"
                }
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
