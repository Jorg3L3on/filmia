import { Platform, TitleKind } from "@/generated/prisma/client";
import { PLATFORMS, TITLE_KINDS } from "@/lib/labels";

const asString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

export const parseTitleKind = (value: FormDataEntryValue | null): TitleKind => {
  const kind = asString(value);
  if (TITLE_KINDS.includes(kind as TitleKind)) {
    return kind as TitleKind;
  }
  throw new Error("El tipo debe ser película o serie.");
};

export const parsePlatform = (
  value: FormDataEntryValue | null,
): Platform | null => {
  const platform = asString(value);
  if (!platform) {
    return null;
  }
  if (PLATFORMS.includes(platform as Platform)) {
    return platform as Platform;
  }
  throw new Error("Plataforma no válida.");
};

export const parseRating = (value: FormDataEntryValue | null) => {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  const rating = Number(raw);
  if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
    throw new Error("La nota debe ser un entero entre 1 y 10.");
  }

  return rating;
};

export const parseYear = (value: FormDataEntryValue | null) => {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  const year = Number(raw);
  if (!Number.isInteger(year) || year < 1888 || year > 2100) {
    throw new Error("El año no es válido.");
  }

  return year;
};

export const parseOptionalDate = (value: FormDataEntryValue | null) => {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("La fecha vista no es válida.");
  }

  return date;
};

export const parseRequiredName = (value: FormDataEntryValue | null) => {
  const name = asString(value);
  if (!name) {
    throw new Error("El nombre es obligatorio.");
  }
  return name;
};

export const parseIdList = (formData: FormData, key: string) =>
  formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.length > 0);

export const parseNewTags = (value: FormDataEntryValue | null) =>
  asString(value)
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
