import { Platform, SeriesStatus } from "@/db";
import { PLATFORMS, SERIES_STATUSES } from "@/lib/labels";

const asString = (value: FormDataEntryValue | null) =>
  typeof value === "string" ? value.trim() : "";

/** «Dónde la vi»: `""` (Ninguna) → null; anything outside the enum throws. */
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

export const parseOptionalReview = (value: FormDataEntryValue | null) => {
  const review = asString(value);
  if (!review) {
    return null;
  }

  if (review.length > 1000) {
    throw new Error("La nota es demasiado larga (máximo 1000 caracteres).");
  }

  return review;
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

export const parseStreamingPlatforms = (formData: FormData): Platform[] => {
  const values = parseIdList(formData, "platforms");
  const invalid = values.some((value) => !PLATFORMS.includes(value as Platform));
  if (invalid) {
    throw new Error("Plataforma no válida.");
  }

  const selected = new Set(values as Platform[]);
  return PLATFORMS.filter((platform) => selected.has(platform));
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const parseOptionalDisplayName = (value: FormDataEntryValue | null) => {
  const name = asString(value);
  if (!name) {
    return null;
  }

  if (name.length > 80) {
    throw new Error("El nombre es demasiado largo (máximo 80 caracteres).");
  }

  return name;
};

export const parseAccountEmail = (value: FormDataEntryValue | null) => {
  const email = asString(value).toLowerCase();
  if (!email) {
    throw new Error("El correo es obligatorio.");
  }

  if (email.length > 254) {
    throw new Error("El correo es demasiado largo.");
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error("El correo no es válido.");
  }

  return email;
};

/** Current + new only: the sheet shows the new one with the eye, so a «confirm» field adds nothing. */
export const parsePasswordChange = (formData: FormData) => {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");

  if (!currentPassword) {
    throw new Error("Escribe tu contraseña actual.");
  }

  if (newPassword.length < 8) {
    throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
  }

  if (currentPassword === newPassword) {
    throw new Error("La nueva contraseña debe ser distinta a la actual.");
  }

  return { currentPassword, newPassword };
};

export const parseSeriesStatus = (
  value: FormDataEntryValue | null,
): SeriesStatus | null => {
  const status = asString(value);
  if (!status || status === "NONE") {
    return null;
  }

  if (SERIES_STATUSES.includes(status as SeriesStatus)) {
    return status as SeriesStatus;
  }

  throw new Error("El estado de la serie no es válido.");
};

export const parseSeriesSeason = (value: FormDataEntryValue | null) => {
  const raw = asString(value);
  if (!raw) {
    return null;
  }

  const season = Number(raw);
  if (!Number.isInteger(season) || season < 1 || season > 100) {
    throw new Error("La temporada debe ser un entero entre 1 y 100.");
  }

  return season;
};
