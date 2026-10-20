import { formatMonthHeading } from "@/lib/dates";
import { PLATFORM_LABEL, formatRuntime, ratingToStars } from "@/lib/labels";
import type { TitleDetail } from "@/lib/title-detail";
import { isoDay } from "@/lib/mcp/shapes/common";

/** Readable Spanish summaries for `fetch` (FIL-I20-4): what ChatGPT quotes back. */

const STATUS_TEXT = {
  pending: "Está en su Quiero ver.",
  watching: "La está viendo (serie en curso).",
  watched: "Ya la vio.",
  saved: "La tiene guardada en su biblioteca.",
  not_in_library: "No está en su biblioteca.",
} as const;

const stars = (rating: number | null | undefined) => {
  const value = ratingToStars(rating);
  return value == null ? null : `${value.toLocaleString("es-MX")} de 5 estrellas`;
};

export const titleFetchText = (detail: TitleDetail) => {
  const row = detail.catalog;
  const genres = ((row.tmdbGenres as { name: string }[] | null) ?? []).map((genre) => genre.name);
  const head = [
    `${row.name}${row.year ? ` (${row.year})` : ""}`,
    row.kind === "SERIES" ? "Serie" : "Película",
    formatRuntime(row.runtimeMinutes),
    genres.length ? genres.join(", ") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const lines = [head, STATUS_TEXT[detail.status]];
  if (detail.own?.watchedAt) lines.push(`La vio el ${isoDay(detail.own.watchedAt)}.`);
  const rating = stars(detail.own?.rating);
  if (rating) lines.push(`Su calificación: ${rating}.`);
  if (detail.own?.review) lines.push(`Su reseña: «${detail.own.review}»`);
  lines.push(
    detail.streamingOn.length
      ? `Dónde verla en México (incluida): ${detail.streamingOn.map((platform) => PLATFORM_LABEL[platform]).join(", ")}.`
      : "No está incluida en ninguna plataforma en México.",
  );
  const rent = detail.providers?.rent.map((offer) => offer.name) ?? [];
  if (rent.length) lines.push(`En renta: ${rent.join(", ")}.`);
  if (detail.directors.length) lines.push(`Dirección: ${detail.directors.join(", ")}.`);
  if (detail.cast.length) lines.push(`Reparto: ${detail.cast.map((person) => person.name).join(", ")}.`);
  if (row.imdbRating) lines.push(`IMDb: ${row.imdbRating}.`);
  if (detail.awards?.summary) lines.push(`Premios: ${detail.awards.summary}.`);
  if (row.overview) lines.push(`Sinopsis: ${row.overview}`);
  return lines.join("\n");
};

export const listFetchText = (list: {
  name: string;
  role: string;
  members: { name: string | null; role: string }[];
  items: { name: string; year: number | null }[];
}) => {
  const lines = [`Lista «${list.name}» · ${list.items.length} títulos · tu rol: ${list.role}.`];
  if (list.members.length > 1) {
    lines.push(`La comparten: ${list.members.map((member) => `${member.name ?? "alguien"} (${member.role})`).join(", ")}.`);
  }
  for (const [index, item] of list.items.slice(0, 50).entries()) {
    lines.push(`${index + 1}. ${item.name}${item.year ? ` (${item.year})` : ""}`);
  }
  if (list.items.length > 50) lines.push(`…y ${list.items.length - 50} más (usa get_list para verlos todos).`);
  return lines.join("\n");
};

export const diaryFetchText = (
  month: string,
  entries: { name: string; year: number | null; watchedAt: Date | null; rating: number | null }[],
) => {
  const lines = [`Diario de ${formatMonthHeading(month)}: ${entries.length} ${entries.length === 1 ? "título" : "títulos"}.`];
  for (const entry of entries) {
    const rating = stars(entry.rating);
    lines.push(`${isoDay(entry.watchedAt)} · ${entry.name}${entry.year ? ` (${entry.year})` : ""}${rating ? ` · ${rating}` : ""}`);
  }
  return lines.join("\n");
};
