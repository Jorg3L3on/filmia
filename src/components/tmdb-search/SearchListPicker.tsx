"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/Button";
import { ListChipGroup, splitAssignableLists } from "@/components/TitleListsPanel";
import {
  diffListSelection,
  listSelectionConfirmLabel,
  toggleListSelection,
  type SelectableList,
} from "@/lib/list-selection";
import { eyebrowClass, focusRing } from "@/lib/ui";

type SearchListPickerProps = {
  lists: SelectableList[];
  initialIds: string[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (selectedIds: string[]) => void;
};

/**
 * «Agregar a lista» inside the Buscar preview: same chips as the ficha's
 * TitleListsPanel, but nothing is written until the user confirms.
 */
export const SearchListPicker = ({
  lists,
  initialIds,
  pending,
  error,
  onCancel,
  onConfirm,
}: SearchListPickerProps) => {
  const [selected, setSelected] = useState(initialIds);
  const selectedSet = new Set(selected);
  const diff = diffListSelection(initialIds, selected);
  const { daily, custom } = splitAssignableLists(lists);

  const handleToggle = (listId: string) => {
    setSelected((current) => toggleListSelection(current, listId));
  };

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={eyebrowClass}>Listas</p>
        <h3 className="font-serif text-xl text-paper">¿Dónde la guardas?</h3>
        <p className="text-sm text-fog">Elige una o varias y confirma.</p>
      </header>

      <ListChipGroup
        title="Diarias"
        lists={daily}
        memberIds={selectedSet}
        pendingId={null}
        onToggle={handleToggle}
        showOpenLink={false}
      />

      {custom.length > 0 ? (
        <ListChipGroup
          title="Personalizadas"
          lists={custom}
          memberIds={selectedSet}
          pendingId={null}
          onToggle={handleToggle}
          showOpenLink={false}
        />
      ) : (
        <p className="text-sm text-mist">
          Aún no hay colecciones propias.{" "}
          <Link
            href="/listas/nueva"
            className={`text-accent underline-offset-2 hover:underline ${focusRing}`}
          >
            Crear una lista
          </Link>
        </p>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger-line bg-danger-well px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Volver
        </Button>
        <Button
          type="button"
          onClick={() => onConfirm(selected)}
          disabled={!diff.changed}
          pending={pending}
          pendingLabel="Guardando…"
          className="press-scale"
        >
          {listSelectionConfirmLabel(diff, selected.length)}
        </Button>
      </div>
    </div>
  );
};
