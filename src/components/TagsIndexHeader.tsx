"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { CreateTagForm } from "@/components/CreateTagForm";
import { ListsEtiquetasSegment } from "@/components/ListsEtiquetasSegment";
import {
  SegmentActionTooltip,
  SegmentPlusIcon,
  segmentActionClass,
} from "@/components/SegmentAction";
import { cn } from "@/lib/cn";

type TagsIndexHeaderProps = {
  createAction: (formData: FormData) => void | Promise<void>;
};

/** Segment + «+» that reveals the create field — mirrors Listas' «+ Nueva lista». */
export const TagsIndexHeader = ({ createAction }: TagsIndexHeaderProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const formId = useId();

  const handleToggle = () => setIsCreating((open) => !open);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    setIsCreating(false);
  };

  return (
    <div className="space-y-4">
      <ListsEtiquetasSegment
        action={
          <button
            type="button"
            onClick={handleToggle}
            aria-expanded={isCreating}
            aria-controls={isCreating ? formId : undefined}
            aria-label={isCreating ? "Cerrar nueva etiqueta" : "Nueva etiqueta"}
            className={cn(
              segmentActionClass,
              isCreating && "border-accent/60 text-paper",
            )}
          >
            <SegmentPlusIcon className={cn(isCreating && "rotate-45")} />
            <SegmentActionTooltip label={isCreating ? "Cancelar" : "Crear etiqueta"} />
          </button>
        }
      />
      {isCreating ? (
        <div
          id={formId}
          onKeyDown={handleKeyDown}
          className="mx-auto w-full max-w-md stagger-in"
        >
          <CreateTagForm action={createAction} prominent autoFocus />
        </div>
      ) : null}
    </div>
  );
};
