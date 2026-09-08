"use client";

import { useState, type ReactNode } from "react";
import { createTitle, updateTitle } from "@/app/actions/titles";
import { PendingSubmit } from "@/components/PendingSubmit";
import { RatingStars } from "@/components/RatingStars";
import { TmdbPicker, type TmdbPick } from "@/components/TmdbPicker";
import { PosterImage } from "@/components/PosterImage";
import type { List, Platform, Tag, Title, TitleKind } from "@/db";
import { cn } from "@/lib/cn";
import {
  PLATFORM_CLASS,
  PLATFORM_LABEL,
  PLATFORMS,
  TITLE_KIND_LABEL,
  TITLE_KINDS,
} from "@/lib/labels";
import { toDateInput } from "@/lib/dates";
import {
  eyebrowClass,
  fieldClass,
  focusRing,
  posterFrame,
  wellClass,
} from "@/lib/ui";

type TitleFormProps = {
  title?: Title & {
    tags: Array<{ tagId: string }>;
    listItems: Array<{ listId: string }>;
  };
  tags: Array<Pick<Tag, "id" | "name" | "slug">>;
  lists: Array<Pick<List, "id" | "name" | "slug">>;
  metadataConfig: { tmdb: boolean; omdb: boolean };
};

const fieldLabel = "text-[11px] font-medium uppercase tracking-[0.18em] text-fog";

const chipClass = (active: boolean) =>
  cn(
    "rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition",
    focusRing,
    active
      ? "border-accent bg-accent text-ink"
      : "border-chrome text-fog hover:border-line-hover hover:text-paper",
  );

export const TitleForm = ({ title, tags, lists, metadataConfig }: TitleFormProps) => {
  const action = title ? updateTitle.bind(null, title.id) : createTitle;
  const selectedTagIds = new Set(title?.tags.map((item) => item.tagId) ?? []);
  const selectedListIds = new Set(title?.listItems.map((item) => item.listId) ?? []);

  const [kind, setKind] = useState<TitleKind>(title?.kind ?? "MOVIE");
  const [name, setName] = useState(title?.name ?? "");
  const [originalName, setOriginalName] = useState(title?.originalName ?? "");
  const [year, setYear] = useState(title?.year ? String(title.year) : "");
  const [rating, setRating] = useState(title?.rating ? String(title.rating) : "");
  const [platform, setPlatform] = useState<Platform | "">(title?.platform ?? "");
  const [posterPath, setPosterPath] = useState(title?.posterPath ?? null);
  const [imdbRating, setImdbRating] = useState(title?.imdbRating ?? null);
  const [pickedLabel, setPickedLabel] = useState(title?.name ?? "");

  const handlePicked = (pick: TmdbPick) => {
    setName(pick.name);
    setOriginalName(pick.originalName ?? "");
    setYear(pick.year ? String(pick.year) : "");
    setPosterPath(pick.posterPath);
    setImdbRating(pick.imdbRating);
    setPickedLabel(pick.name);
  };

  const handleCleared = () => {
    setPosterPath(title?.posterPath ?? null);
    setImdbRating(title?.imdbRating ?? null);
    setPickedLabel(title?.name ?? "");
  };

  return (
    <form action={action} className="space-y-8 pb-4">
      <div className="grid items-start gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="mx-auto w-40 lg:sticky lg:top-24 lg:mx-0 lg:w-full">
          {posterPath ? (
            <PosterImage
              name={pickedLabel || name || "Poster"}
              posterPath={posterPath}
              className={posterFrame}
              sizes="200px"
              priority
            />
          ) : (
            <div
              className={cn(
                posterFrame,
                "flex aspect-[2/3] items-center justify-center border border-dashed border-chrome bg-well px-4 text-center",
              )}
            >
              <p className="text-[11px] uppercase tracking-[0.16em] text-mist">
                El poster aparece al elegir un título
              </p>
            </div>
          )}
          {imdbRating != null ? (
            <p className="mt-3 text-center text-sm text-imdb">
              IMDb {imdbRating.toFixed(1)}/10
            </p>
          ) : null}
        </aside>

        <div className="space-y-6">
          <section className={cn(wellClass, "space-y-4 border-accent/30 p-5")}>
            <header className="space-y-1">
              <p className={eyebrowClass}>TMDB</p>
              <h2 className="font-serif text-xl text-paper">
                ¿No encuentras la película o serie?
              </h2>
              <p className="text-sm text-fog">
                Busca en TMDB y añade títulos con toda su información en un solo paso.
              </p>
            </header>
            <div className="space-y-3">
              <p className={fieldLabel}>Tipo</p>
              <div
                role="group"
                aria-label="Tipo de título"
                className="inline-flex rounded-full border border-chrome bg-well p-1"
              >
                {TITLE_KINDS.map((item) => {
                  const isCurrent = kind === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => setKind(item)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-medium uppercase tracking-wide",
                        focusRing,
                        isCurrent ? "bg-accent text-ink" : "text-fog hover:text-paper",
                      )}
                    >
                      {TITLE_KIND_LABEL[item]}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="kind" value={kind} />
            </div>
            <TmdbPicker
              configured={metadataConfig}
              kind={kind}
              onPicked={handlePicked}
              onCleared={handleCleared}
              initialTmdbId={title?.tmdbId}
              initialPosterPath={title?.posterPath}
              initialImdbId={title?.imdbId}
              initialImdbRating={title?.imdbRating}
            />
          </section>

          <ManualBlock title={Boolean(title)}>
          <section className={cn(wellClass, "space-y-4 p-5")}>
            <header className="space-y-1">
              <p className={eyebrowClass}>Ficha</p>
              <h2 className="font-serif text-xl text-paper">Identidad</h2>
            </header>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1.5 sm:col-span-2">
                <span className={fieldLabel}>Nombre</span>
                <input
                  name="name"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className={fieldClass}
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1.5 sm:col-span-2">
                <span className={fieldLabel}>Nombre original</span>
                <input
                  name="originalName"
                  value={originalName}
                  onChange={(event) => setOriginalName(event.target.value)}
                  className={fieldClass}
                  autoComplete="off"
                />
              </label>
              <label className="block space-y-1.5">
                <span className={fieldLabel}>Año</span>
                <input
                  name="year"
                  type="number"
                  min={1888}
                  max={2100}
                  value={year}
                  onChange={(event) => setYear(event.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>
          </section>

          <section className={cn(wellClass, "space-y-5 p-5")}>
            <header className="space-y-1">
              <p className={eyebrowClass}>Tu vista</p>
              <h2 className="font-serif text-xl text-paper">Cómo lo viste</h2>
            </header>

            <div className="space-y-2">
              <p className={fieldLabel}>Tu nota</p>
              <RatingStars
                value={rating ? Number(rating) : null}
                onChange={(next) => setRating(String(next))}
                size="md"
              />
              <input type="hidden" name="rating" value={rating} />
            </div>

            <div className="space-y-2">
              <p className={fieldLabel}>Plataforma</p>
              <div role="group" aria-label="Plataforma" className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={platform === ""}
                  onClick={() => setPlatform("")}
                  className={chipClass(platform === "")}
                >
                  Ninguna
                </button>
                {PLATFORMS.map((item) => {
                  const isCurrent = platform === item;
                  return (
                    <button
                      key={item}
                      type="button"
                      aria-pressed={isCurrent}
                      onClick={() => setPlatform(item)}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide",
                        focusRing,
                        isCurrent
                          ? PLATFORM_CLASS[item]
                          : "border border-chrome text-fog hover:text-paper",
                      )}
                    >
                      {PLATFORM_LABEL[item]}
                    </button>
                  );
                })}
              </div>
              <input type="hidden" name="platform" value={platform} />
            </div>

            <label className="block max-w-xs space-y-1.5">
              <span className={fieldLabel}>Vista el</span>
              <input
                name="watchedAt"
                type="date"
                defaultValue={toDateInput(title?.watchedAt ?? null)}
                className={`${fieldClass} [color-scheme:dark]`}
              />
            </label>

            <label className="block space-y-1.5">
              <span className={fieldLabel}>Notas</span>
              <textarea
                name="review"
                rows={4}
                defaultValue={title?.review ?? ""}
                placeholder="Una línea, un spoiler, un veredicto…"
                maxLength={1000}
                className={fieldClass}
              />
            </label>
          </section>

          <section className={cn(wellClass, "space-y-5 p-5")}>
            <header className="space-y-1">
              <p className={eyebrowClass}>Colección</p>
              <h2 className="font-serif text-xl text-paper">Etiquetas y listas</h2>
            </header>

            <fieldset className="space-y-3">
              <legend className={fieldLabel}>Etiquetas</legend>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <label
                    key={tag.id}
                    className="cursor-pointer rounded-full border border-chrome px-3 py-1.5 text-xs text-fog transition hover:text-paper has-checked:border-accent has-checked:bg-accent has-checked:text-ink"
                  >
                    <input
                      type="checkbox"
                      name="tagIds"
                      value={tag.id}
                      defaultChecked={selectedTagIds.has(tag.id)}
                      className="sr-only"
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
              <label className="block max-w-md space-y-1.5">
                <span className="text-xs text-fog">Nuevas, separadas por coma</span>
                <input
                  name="newTags"
                  placeholder="épico, sci-fi"
                  className={fieldClass}
                  autoComplete="off"
                />
              </label>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className={fieldLabel}>Listas</legend>
              {lists.length === 0 ? (
                <p className="text-sm text-mist">
                  Todavía no hay listas de colección. Favoritas y Por rewatch
                  aparecen al entrar.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {lists.map((list) => (
                    <label
                      key={list.id}
                      className="cursor-pointer rounded-full border border-chrome px-3 py-1.5 text-xs text-fog transition hover:text-paper has-checked:border-accent has-checked:bg-accent has-checked:text-ink"
                    >
                      <input
                        type="checkbox"
                        name="listIds"
                        value={list.id}
                        defaultChecked={selectedListIds.has(list.id)}
                        className="sr-only"
                      />
                      {list.name}
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
          </section>
          </ManualBlock>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-mist">
          Siempre puedes editar la información más tarde.
        </p>
        <PendingSubmit
          idleLabel={title ? "Guardar cambios" : "Registrar en el diario"}
          pendingLabel={title ? "Guardando…" : "Registrando…"}
        />
      </div>
    </form>
  );
};

const ManualBlock = ({
  title,
  children,
}: {
  title: boolean;
  children: ReactNode;
}) => {
  if (title) {
    return <>{children}</>;
  }

  return (
    <details className="group rounded-2xl border border-line bg-surface open:bg-surface">
      <summary className="cursor-pointer list-none px-5 py-4 text-sm text-fog [&::-webkit-details-marker]:hidden">
        O regístralo manualmente
      </summary>
      <div className="space-y-6 border-t border-line px-5 pb-5 pt-4">{children}</div>
    </details>
  );
};
