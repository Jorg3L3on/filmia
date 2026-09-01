import { createTitle, updateTitle } from "@/app/actions/titles";
import { TmdbPicker } from "@/components/TmdbPicker";
import type { List, Platform, Tag, Title, TitleKind } from "@/generated/prisma/client";
import { PLATFORM_LABEL, PLATFORMS, TITLE_KIND_LABEL, TITLE_KINDS } from "@/lib/labels";

type TitleFormProps = {
  title?: Title & {
    tags: Array<{ tagId: string }>;
    listItems: Array<{ listId: string }>;
  };
  tags: Tag[];
  lists: Array<Pick<List, "id" | "name">>;
  metadataConfig: { tmdb: boolean; omdb: boolean };
};

const fieldClass =
  "w-full rounded-md border border-[#2c3440] bg-[#14181c] px-3 py-2 text-sm text-white placeholder:text-[#667] focus:border-[#00e054] focus:outline-none";

const toDateInput = (value: Date | null) =>
  value ? value.toISOString().slice(0, 10) : "";

export const TitleForm = ({ title, tags, lists, metadataConfig }: TitleFormProps) => {
  const action = title ? updateTitle.bind(null, title.id) : createTitle;
  const selectedTagIds = new Set(title?.tags.map((item) => item.tagId) ?? []);
  const selectedListIds = new Set(title?.listItems.map((item) => item.listId) ?? []);

  return (
    <form action={action} className="space-y-6">
      <TmdbPicker
        configured={metadataConfig}
        initialTmdbId={title?.tmdbId}
        initialPosterPath={title?.posterPath}
        initialImdbId={title?.imdbId}
        initialImdbRating={title?.imdbRating}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">Nombre</span>
          <input
            name="name"
            required
            defaultValue={title?.name ?? ""}
            className={fieldClass}
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Nombre original
          </span>
          <input
            name="originalName"
            defaultValue={title?.originalName ?? ""}
            className={fieldClass}
            autoComplete="off"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">Tipo</span>
          <select
            name="kind"
            required
            defaultValue={title?.kind ?? ("MOVIE" satisfies TitleKind)}
            className={fieldClass}
          >
            {TITLE_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {TITLE_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">Año</span>
          <input
            name="year"
            type="number"
            min={1888}
            max={2100}
            defaultValue={title?.year ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Tu nota (1–10)
          </span>
          <input
            name="rating"
            type="number"
            min={1}
            max={10}
            defaultValue={title?.rating ?? ""}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Plataforma
          </span>
          <select
            name="platform"
            defaultValue={title?.platform ?? ""}
            className={fieldClass}
          >
            <option value="">Sin plataforma</option>
            {PLATFORMS.map((platform: Platform) => (
              <option key={platform} value={platform}>
                {PLATFORM_LABEL[platform]}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Vista el
          </span>
          <input
            name="watchedAt"
            type="date"
            defaultValue={toDateInput(title?.watchedAt ?? null)}
            className={fieldClass}
          />
        </label>
        <label className="block space-y-1.5 md:col-span-2">
          <span className="text-xs uppercase tracking-wide text-[#99aabb]">
            Notas
          </span>
          <textarea
            name="review"
            rows={4}
            defaultValue={title?.review ?? ""}
            className={fieldClass}
          />
        </label>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wide text-[#99aabb]">
          Etiquetas
        </legend>
        <div className="flex flex-wrap gap-3">
          {tags.map((tag) => (
            <label key={tag.id} className="flex items-center gap-2 text-sm text-[#def]">
              <input
                type="checkbox"
                name="tagIds"
                value={tag.id}
                defaultChecked={selectedTagIds.has(tag.id)}
                className="accent-[#00e054]"
              />
              {tag.name}
            </label>
          ))}
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs text-[#99aabb]">Nuevas (separadas por coma)</span>
          <input
            name="newTags"
            placeholder="épico, sci-fi"
            className={fieldClass}
            autoComplete="off"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-xs uppercase tracking-wide text-[#99aabb]">
          Listas
        </legend>
        <div className="flex flex-wrap gap-3">
          {lists.map((list) => (
            <label key={list.id} className="flex items-center gap-2 text-sm text-[#def]">
              <input
                type="checkbox"
                name="listIds"
                value={list.id}
                defaultChecked={selectedListIds.has(list.id)}
                className="accent-[#00e054]"
              />
              {list.name}
            </label>
          ))}
        </div>
      </fieldset>

      <button
        type="submit"
        className="rounded-full bg-[#00e054] px-5 py-2 text-sm font-semibold text-[#14181c] hover:bg-[#00c030] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {title ? "Guardar cambios" : "Crear título"}
      </button>
    </form>
  );
};
