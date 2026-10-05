"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { isTagsPath } from "@/lib/nav";

const SEGMENTS = [
  { href: "/listas", key: "listas", label: "Listas" },
  { href: "/tags", key: "etiquetas", label: "Etiquetas" },
] as const;

type ListsEtiquetasSegmentProps = {
  /** Create action rendered beside the pill (e.g. «+» for Nueva lista). */
  action?: ReactNode;
};

/** Listas | Etiquetas glass segment (SegmentedTabs uses tab-transition + sliding aura pill). */
export const ListsEtiquetasSegment = ({ action }: ListsEtiquetasSegmentProps) => {
  const pathname = usePathname();
  const onTags = isTagsPath(pathname);

  return (
    <div className="mx-auto flex w-full max-w-md items-center gap-2">
      <SegmentedTabs
        items={SEGMENTS}
        activeKey={onTags ? "etiquetas" : "listas"}
        aria-label="Listas y etiquetas"
        className="flex-1"
      />
      {action}
    </div>
  );
};
