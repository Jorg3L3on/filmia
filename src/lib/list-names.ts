import { slugify } from "@/lib/labels";

export const LIST_NAME_TAKEN_MESSAGE = "Ya tienes una lista con ese nombre.";

/** Estado de los formularios de crear/editar lista (`useActionState`). */
export type ListFormState = {
  error: string;
  values: { name: string; description: string };
} | null;

type ExistingListName = { id: string; name: string };

/**
 * Clave para comparar nombres de lista: insensible a mayúsculas, acentos,
 * espacios y puntuación (`slugify`). Si el nombre no deja nada alfanumérico
 * (p. ej. solo emoji), se compara el texto en minúsculas con espacios colapsados.
 */
export const listNameKey = (name: string) => {
  const slug = slugify(name);
  if (slug) {
    return slug;
  }

  return name.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
};

/**
 * ¿Hay otra lista del usuario (diarias incluidas) con el mismo nombre
 * normalizado? `excludeListId` deja fuera la lista que se está renombrando.
 */
export const hasDuplicateListName = (
  name: string,
  existing: readonly ExistingListName[],
  excludeListId?: string,
) => {
  const key = listNameKey(name);
  return existing.some(
    (list) => list.id !== excludeListId && listNameKey(list.name) === key,
  );
};

/**
 * ¿Se rechaza renombrar `current` a `name`? Si la clave normalizada no cambia
 * (misma lista, solo mayúsculas/acentos/espacios o solo la descripción), se
 * permite aunque ya existan duplicados históricos; si cambia, no puede chocar
 * con otra lista del usuario.
 */
export const isRenameBlocked = (
  name: string,
  existing: readonly ExistingListName[],
  current: ExistingListName,
) =>
  listNameKey(name) !== listNameKey(current.name) &&
  hasDuplicateListName(name, existing, current.id);
