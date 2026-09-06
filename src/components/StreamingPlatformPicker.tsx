import { updateStreamingPlatforms } from "@/app/actions/profile";
import { PlatformLogo } from "@/components/PlatformLogo";
import type { Platform } from "@/db";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { btnPrimary, focusRing, wellClass } from "@/lib/ui";

type StreamingPlatformPickerProps = {
  selected: Platform[];
};

export const StreamingPlatformPicker = ({
  selected,
}: StreamingPlatformPickerProps) => {
  const selectedSet = new Set(selected);

  return (
    <form action={updateStreamingPlatforms} className={`${wellClass} space-y-5 p-5`}>
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <TvIcon />
          <h2 className="text-lg font-semibold text-paper">Plataformas MX</h2>
        </div>
        <p className="text-sm text-fog">
          Selecciona tus servicios de streaming disponibles en México.
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">Plataformas de streaming en México</legend>
        <ul className="flex flex-wrap gap-2">
          {PLATFORMS.map((platform) => {
            const isSelected = selectedSet.has(platform);
            return (
              <li key={platform}>
                <label
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                    focusRing,
                    "has-checked:border-accent has-checked:bg-accent has-checked:text-ink",
                    "border-chrome bg-well text-paper",
                  )}
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform}
                    defaultChecked={isSelected}
                    className="peer sr-only"
                  />
                  <span className="hidden text-xs font-bold peer-checked:inline" aria-hidden>
                    ✓
                  </span>
                  <span className="text-xs peer-checked:hidden" aria-hidden>
                    +
                  </span>
                  {PLATFORM_SERVICE_LABEL[platform]}
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex justify-end">
        <button type="submit" className={btnPrimary}>
          Guardar cambios
        </button>
      </div>
    </form>
  );
};

const TvIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 text-accent" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
    <rect x="4" y="6.5" width="16" height="11" rx="1.5" />
    <path strokeLinecap="round" d="M8 20h8M12 6.5 9.5 4M12 6.5 14.5 4" />
  </svg>
);
