"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { isTagsPath } from "@/lib/nav";
import { focusRing } from "@/lib/ui";

const SEGMENTS = [
  { href: "/listas", id: "listas", label: "Listas" },
  { href: "/tags", id: "etiquetas", label: "Etiquetas" },
] as const;

export const ListsEtiquetasSegment = () => {
  const pathname = usePathname();
  const onTags = isTagsPath(pathname);

  return (
    <div
      role="tablist"
      aria-label="Listas y etiquetas"
      className="mx-auto flex w-full max-w-sm rounded-full border border-chrome bg-well p-1"
    >
      {SEGMENTS.map((item) => {
        const selected = item.id === "etiquetas" ? onTags : !onTags;

        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex-1 rounded-full px-4 py-2.5 text-center text-xs font-semibold uppercase tracking-[0.14em] tab-transition",
              focusRing,
              selected
                ? "bg-accent text-ink shadow-[0_6px_16px_rgba(124,156,255,0.28)]"
                : "text-fog hover:text-paper",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
};
