"use client";

import { usePathname, useRouter } from "next/navigation";
import type { CarteleraOrder } from "@/lib/cine-core";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

const OPTIONS: { value: CarteleraOrder; label: string }[] = [
  { value: "recientes", label: "Recientes" },
  { value: "populares", label: "Populares" },
];

/** Segmented Recientes / Populares (FIL-I23-5): `?orden=` on the URL, so the order survives a reload. */
export const CarteleraOrderToggle = ({ order }: { order: CarteleraOrder }) => {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div role="group" aria-label="Orden" className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/[0.04] p-0.5">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={order === option.value}
          onClick={() => {
            if (order !== option.value) {
              router.replace(option.value === "recientes" ? pathname : `${pathname}?orden=${option.value}`, { scroll: false });
            }
          }}
          className={cn(
            "relative h-8 rounded-full px-3 text-xs font-semibold transition-colors before:absolute before:inset-x-0 before:-inset-y-1.5 before:content-['']",
            order === option.value ? "bg-cine text-ink" : "text-fog hover:text-paper",
            focusRing,
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
};
