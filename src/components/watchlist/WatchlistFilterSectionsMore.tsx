"use client";

import { useState } from "react";
import { ChipWrap, FilterChip, FilterSection, FilterSwitchRow } from "@/components/watchlist/WatchlistFilterControls";
import type { SectionProps } from "@/components/watchlist/WatchlistFilterSections";
import { cn } from "@/lib/cn";
import { fieldClass } from "@/lib/ui";
import { ADDED_LABEL, languageName } from "@/lib/watchlist-chips";
import { optionQuery, toggleValue } from "@/lib/watchlist-facets";
import type { WatchlistGenreCount } from "@/lib/watchlist-filters";
import { ADDED_OPTIONS, IMDB_MIN_OPTIONS } from "@/lib/watchlist-query";
import type { WatchlistPersonCount } from "@/lib/watchlist-rows";

/** Filtros sheet, second half (FIL-I34-4): nota, género, más, director, agregada, idioma. */

export const RatingSection = ({ draft, count, onChange }: SectionProps) => (
  <FilterSection title="Nota IMDb mínima">
    <ChipWrap label="Nota IMDb mínima">
      <FilterChip selected={draft.imdbMin == null} onClick={() => onChange({ ...draft, imdbMin: null })}>
        Cualquiera
      </FilterChip>
      {IMDB_MIN_OPTIONS.map((value) => (
        <FilterChip
          key={value}
          selected={draft.imdbMin === value}
          count={count({ ...draft, imdbMin: value })}
          label={`Nota ${value} o más`}
          onClick={() => onChange({ ...draft, imdbMin: draft.imdbMin === value ? null : value })}
        >
          {value}+
        </FilterChip>
      ))}
    </ChipWrap>
    <FilterSwitchRow
      label="Pedir 1 000 votos o más"
      hint="Evita notas altas con pocos votos"
      checked={draft.votesFloor}
      count={count({ ...draft, votesFloor: true })}
      onChange={(votesFloor) => onChange({ ...draft, votesFloor })}
    />
  </FilterSection>
);

export const GenreSection = ({ draft, count, onChange, genres }: SectionProps & { genres: WatchlistGenreCount[] }) => (
  <FilterSection
    title="Género"
    aside={draft.genres.length > 0 ? `${draft.genres.length} ${draft.genres.length === 1 ? "elegido" : "elegidos"}` : null}
  >
    <ChipWrap label="Géneros">
      {genres.map((genre) => (
        <FilterChip
          key={genre.id}
          selected={draft.genres.includes(genre.id)}
          count={count(optionQuery(draft, "genres", genre.id))}
          onClick={() => onChange({ ...draft, genres: toggleValue(draft.genres, genre.id) })}
        >
          {genre.name}
        </FilterChip>
      ))}
    </ChipWrap>
  </FilterSection>
);

export const MoreSection = ({ draft, count, onChange }: SectionProps) => (
  <FilterSection title="Más">
    <div className="space-y-1">
      <FilterSwitchRow
        label="Premiadas"
        hint="Con un premio o nominación"
        checked={draft.awarded}
        count={count({ ...draft, awarded: true })}
        onChange={(awarded) => onChange({ ...draft, awarded })}
      />
      <FilterSwitchRow
        label="Ocultar «Ahora no»"
        hint="Las que pospusiste hace menos de 14 días"
        checked={draft.hideSnoozed}
        count={count({ ...draft, hideSnoozed: true })}
        onChange={(hideSnoozed) => onChange({ ...draft, hideSnoozed })}
      />
      <FilterSwitchRow
        label="Solo con nota mía"
        hint="Títulos con una nota que escribiste"
        checked={draft.withNote}
        count={count({ ...draft, withNote: true })}
        onChange={(withNote) => onChange({ ...draft, withNote })}
      />
    </div>
  </FilterSection>
);

/** Shown before typing; the field searches the rest. */
const FIRST_PEOPLE = 6;

const fold = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

export const PeopleSection = ({ draft, count, onChange, people }: SectionProps & { people: WatchlistPersonCount[] }) => {
  const [search, setSearch] = useState("");
  const needle = fold(search.trim());
  const matches = needle
    ? people.filter((person) => fold(person.name).includes(needle))
    : people.filter((person, index) => index < FIRST_PEOPLE || draft.people.includes(person.id));
  if (people.length === 0) return null;

  return (
    <FilterSection title="Director o directora" badge="Datos parciales">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nombre"
        aria-label="Buscar director o directora"
        className={cn(fieldClass, "h-11 rounded-full px-4 text-sm")}
        data-no-sheet-drag
      />
      <ChipWrap label="Directores y directoras">
        {matches.slice(0, 24).map((person) => (
          <FilterChip
            key={person.id}
            selected={draft.people.includes(person.id)}
            count={count(optionQuery(draft, "people", person.id))}
            onClick={() => onChange({ ...draft, people: toggleValue(draft.people, person.id) })}
          >
            {person.name}
          </FilterChip>
        ))}
      </ChipWrap>
      <p className="text-xs text-mist">Solo títulos ya enriquecidos. Escribe para buscar otros.</p>
    </FilterSection>
  );
};

export const AddedSection = ({ draft, count, onChange }: SectionProps) => (
  <FilterSection title="Agregada">
    <ChipWrap label="Agregada">
      {ADDED_OPTIONS.map((added) => (
        <FilterChip
          key={added}
          selected={draft.added === added}
          count={count({ ...draft, added })}
          onClick={() => onChange({ ...draft, added: draft.added === added ? null : added })}
        >
          {ADDED_LABEL[added]}
        </FilterChip>
      ))}
    </ChipWrap>
  </FilterSection>
);

export const LanguageSection = ({
  draft,
  count,
  onChange,
  languages,
}: SectionProps & { languages: { code: string; count: number }[] }) =>
  languages.length < 2 && draft.languages.length === 0 ? null : (
    <FilterSection title="Idioma original">
      <ChipWrap label="Idiomas">
        {languages.map((language) => (
          <FilterChip
            key={language.code}
            selected={draft.languages.includes(language.code)}
            count={count(optionQuery(draft, "languages", language.code))}
            onClick={() => onChange({ ...draft, languages: toggleValue(draft.languages, language.code) })}
          >
            {languageName(language.code)}
          </FilterChip>
        ))}
      </ChipWrap>
    </FilterSection>
  );
