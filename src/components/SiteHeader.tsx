"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Diario" },
  { href: "/listas", label: "Listas" },
  { href: "/titulos/nuevo", label: "Nuevo título" },
] as const;

export const SiteHeader = () => {
  const currentPath = usePathname();

  return (
    <header className="border-b border-[#2c3440] bg-[#14181c]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <Link
          href="/"
          className="font-serif text-2xl tracking-wide text-[#00e054] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#00e054]"
          aria-label="Filmia, ir al inicio"
        >
          Filmia
        </Link>
        <nav aria-label="Principal" className="flex flex-wrap items-center gap-2 text-sm">
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
                    ? "rounded-full bg-[#00e054] px-3 py-1.5 font-medium text-[#14181c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    : "rounded-full px-3 py-1.5 text-[#99aabb] hover:bg-[#2c3440] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
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
