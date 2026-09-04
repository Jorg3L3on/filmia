import { updateStreamingPlatforms } from "@/app/actions/profile";
import { PlatformLogo } from "@/components/PlatformLogo";
import type { Platform } from "@/generated/prisma/browser";
import { cn } from "@/lib/cn";
import { PLATFORM_SERVICE_LABEL, PLATFORMS } from "@/lib/labels";
import { btnPrimary, eyebrowClass, focusRing, wellClass } from "@/lib/ui";

type StreamingPlatformPickerProps = {
  selected: Platform[];
};

export const StreamingPlatformPicker = ({
  selected,
}: StreamingPlatformPickerProps) => {
  const selectedSet = new Set(selected);
  const hasSelection = selected.length > 0;

  return (
    <form action={updateStreamingPlatforms} className="space-y-5">
      <header className="space-y-1">
        <p className={eyebrowClass}>Streaming</p>
        <h2 className="font-serif text-2xl text-white">Tus plataformas</h2>
        <p className="text-sm leading-relaxed text-fog">
          {hasSelection
            ? `${selected.length} ${selected.length === 1 ? "contratada" : "contratadas"} en México. Las marcamos en «dónde ver» y filtran «Solo en mis plataformas».`
            : "Elige tus plataformas para marcar cuáles son tuyas y filtrar el diario por lo incluido en tus suscripciones."}
        </p>
      </header>

      <fieldset className={cn(wellClass, "space-y-3 p-4 sm:p-5")}>
        <legend className="sr-only">Plataformas de streaming en México</legend>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PLATFORMS.map((platform) => {
            const isSelected = selectedSet.has(platform);

            return (
              <li key={platform}>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border border-chrome bg-well/70 px-3 py-3 transition",
                    "hover:border-[#555]",
                    "has-checked:border-accent has-checked:bg-accent/10",
                    focusRing,
                  )}
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform}
                    defaultChecked={isSelected}
                    className="peer sr-only"
                  />
                  <PlatformLogo platform={platform} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-white">
                      {PLATFORM_SERVICE_LABEL[platform]}
                    </span>
                    <span className="block text-[11px] text-mist">México</span>
                  </span>
                  <span
                    className="hidden text-[10px] font-semibold uppercase tracking-[0.14em] text-accent peer-checked:inline"
                    aria-hidden
                  >
                    Tuya
                  </span>
                  <span
                    className="text-[10px] font-medium uppercase tracking-[0.14em] text-mist peer-checked:hidden"
                    aria-hidden
                  >
                    Añadir
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="text-[10px] text-faint">
          Logos y catálogo de{" "}
          <a
            href="https://www.justwatch.com/mx"
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-2 hover:text-fog hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            JustWatch
          </a>
        </p>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btnPrimary}>
          Guardar plataformas
        </button>
        {!hasSelection ? (
          <p className="text-sm text-fog">Elige tus plataformas y guarda.</p>
        ) : null}
      </div>
    </form>
  );
};
