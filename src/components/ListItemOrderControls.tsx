import { moveListItem } from "@/app/actions/lists";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

type ListItemOrderControlsProps = {
  listId: string;
  titleId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

export const ListItemOrderControls = ({
  listId,
  titleId,
  canMoveUp,
  canMoveDown,
}: ListItemOrderControlsProps) => {
  const moveUp = moveListItem.bind(null, listId, titleId, "up");
  const moveDown = moveListItem.bind(null, listId, titleId, "down");

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Orden en la lista">
      <OrderButton
        action={moveUp}
        disabled={!canMoveUp}
        label="Subir"
        icon="up"
      />
      <OrderButton
        action={moveDown}
        disabled={!canMoveDown}
        label="Bajar"
        icon="down"
      />
    </div>
  );
};

const OrderButton = ({
  action,
  disabled,
  label,
  icon,
}: {
  action: () => Promise<void>;
  disabled: boolean;
  label: string;
  icon: "up" | "down";
}) => {
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={disabled}
        aria-label={label}
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full border border-chrome text-fog transition",
          focusRing,
          disabled
            ? "cursor-not-allowed opacity-35"
            : "hover:border-accent hover:text-white",
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 fill-none stroke-current stroke-[1.75]"
        >
          {icon === "up" ? (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 14.5 12 8.5l6 6" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9.5 12 15.5l6-6" />
          )}
        </svg>
      </button>
    </form>
  );
};
