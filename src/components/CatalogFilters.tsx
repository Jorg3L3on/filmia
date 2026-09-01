import { PLATFORM_LABEL, PLATFORMS, TITLE_KIND_LABEL, TITLE_KINDS } from "@/lib/labels";

type CatalogFiltersProps = {
  q: string;
  kind: string;
  platform: string;
  tag: string;
  sort: string;
  tags: Array<{ slug: string; name: string }>;
};

const selectClass =
  "rounded-md border border-[#2c3440] bg-[#14181c] px-3 py-2 text-sm text-white focus:border-[#00e054] focus:outline-none";

export const CatalogFilters = ({
  q,
  kind,
  platform,
  tag,
  sort,
  tags,
}: CatalogFiltersProps) => {
  return (
    <form
      method="get"
      className="grid gap-3 rounded-lg border border-[#2c3440] bg-[#1c2228] p-4 md:grid-cols-5"
      role="search"
      aria-label="Filtrar títulos"
    >
      <label className="block space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">Buscar</span>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Gladiator, Dune…"
          className={`${selectClass} w-full`}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">Tipo</span>
        <select name="kind" defaultValue={kind} className={`${selectClass} w-full`}>
          <option value="ALL">Todos</option>
          {TITLE_KINDS.map((value) => (
            <option key={value} value={value}>
              {TITLE_KIND_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">Plataforma</span>
        <select name="platform" defaultValue={platform} className={`${selectClass} w-full`}>
          <option value="ALL">Todas</option>
          {PLATFORMS.map((value) => (
            <option key={value} value={value}>
              {PLATFORM_LABEL[value]}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">Etiqueta</span>
        <select name="tag" defaultValue={tag} className={`${selectClass} w-full`}>
          <option value="">Todas</option>
          {tags.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1 md:col-span-2">
        <span className="text-xs uppercase tracking-wide text-[#99aabb]">Orden</span>
        <select name="sort" defaultValue={sort} className={`${selectClass} w-full`}>
          <option value="recent">Recientes</option>
          <option value="rating">Mejor nota</option>
          <option value="name">Nombre</option>
          <option value="year">Año</option>
        </select>
      </label>
      <div className="flex items-end md:col-span-3">
        <button
          type="submit"
          className="rounded-full bg-[#2c3440] px-4 py-2 text-sm text-white hover:bg-[#3a4452] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00e054]"
        >
          Aplicar filtros
        </button>
      </div>
    </form>
  );
};
