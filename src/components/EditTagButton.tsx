"use client";

import { useCallback, useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { renameTag } from "@/app/actions/tags";
import { Button } from "@/components/Button";
import { PencilIcon } from "@/components/SegmentAction";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { showToast } from "@/lib/toast";
import { fieldClass, pillActionClass } from "@/lib/ui";
import { actionErrorMessage } from "@/lib/use-optimistic-action";

type EditTagButtonProps = {
  tagId: string;
  tagName: string;
};

export const EditTagButton = ({ tagId, tagName }: EditTagButtonProps) => {
  const router = useRouter();
  const headingId = useId();
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleOpen = () => {
    setError(null);
    setOpen(true);
  };

  const handleClose = useCallback(() => {
    if (isPending) return;
    setOpen(false);
  }, [isPending]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextName = String(formData.get("name") ?? "").trim();
    if (nextName === tagName) {
      setOpen(false);
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const slug = await renameTag(tagId, formData);
        setOpen(false);
        showToast({ title: "Etiqueta renombrada", description: nextName });
        router.replace(`/tags/${slug}`);
      } catch (caught) {
        setError(actionErrorMessage(caught));
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Editar etiqueta"
        className={pillActionClass.neutral}
      >
        <PencilIcon />
        Editar
      </button>

      <Sheet
        open={open}
        onClose={handleClose}
        labelledBy={headingId}
        overlayLabel="Cancelar"
        portal
      >
        <form onSubmit={handleSubmit} className="flex flex-col px-6 pb-2 pt-3">
          <SheetHandle className="self-center sm:hidden" />
          <h2 id={headingId} className="mt-3 font-serif text-2xl text-paper">
            Editar etiqueta
          </h2>
          <label htmlFor={inputId} className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-fog">
            Nombre
          </label>
          <input
            id={inputId}
            name="name"
            defaultValue={tagName}
            required
            maxLength={60}
            autoComplete="off"
            autoFocus
            className={`${fieldClass} mt-1.5`}
          />
          {error ? (
            <p
              role="alert"
              className="mt-3 rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-5" data-no-sheet-drag>
            <Button
              type="submit"
              size="lg"
              pending={isPending}
              pendingLabel="Guardando…"
              className="press-scale w-full rounded-full"
            >
              Guardar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={handleClose}
              disabled={isPending}
              className="w-full rounded-full"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Sheet>
    </>
  );
};
