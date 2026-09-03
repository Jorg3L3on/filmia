import { PLATFORM_LABEL, PLATFORMS, TITLE_KIND_LABEL, TITLE_KINDS } from "@/lib/labels";
import { btnSecondary, fieldClass } from "@/lib/ui";

type CatalogFiltersProps = {
  q: string;
  kind: string;
  platform: string;
  tag: string;
  sort: string;
  view?: string;
  tags: Array<{ slug: string; name: string }>;
};

export const CatalogFilters = ({
  q,
  kind,
  platform,
  tag,
  sort,
  view,
  tags,
}: CatalogFiltersProps) => {
  return (
    <form
      method="get"
      className="grid gap-3 rounded-md border border-line bg-well/80 p-4 md:grid-cols-5"
      role="search"
      aria-label="Filtrar títulos"
    >
      {view && view !== "calendar" ? (
        <input type="hidden" name="view" value={view} />
      ) : null}
      <label className="block space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-fog">Buscar</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Gladiator, Dune…"
          className={`${fieldClass} w-full`}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-fog">Tipo</span>
        <select name="kind" defaultValue={kind} className={`${fieldClass} w-full`}>
          <option value="ALL">Todos</option>
          {TITLE_KINDS.map((value) => (
            <option key={value} value={value}>
              {TITLE_KIND_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-fog">Plataforma</span>
        <select name="platform" defaultValue={platform} className={`${fieldClass} w-full`}>
          <option value="ALL">Todas</option>
          {PLATFORMS.map((value) => (
            <option key={value} value={value}>
              {PLATFORM_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-fog">Etiqueta</span>
        <select name="tag" defaultValue={tag} className={`${fieldClass} w-full`}>
          <option value="">Todas</option>
          {tags.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-fog">Orden</span>
        <select name="sort" defaultValue={sort} className={`${fieldClass} w-full`}>
          <option value="watched">Fecha vista</option>
          <option value="recent">Recientes</option>
          <option value="rating">Mejor nota</option>
          <option value="name">Nombre</option>
          <option value="year">Año</option>
        </select>
      </label>
      <div className="flex items-end md:col-span-3">
        <button type="submit" className={btnSecondary}>
          Aplicar filtros
        </button>
      </div>
    </form>
  );
};
