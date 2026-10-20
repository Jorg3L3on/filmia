/** How Perfil → Conexiones names what a connection did (FIL-I20-6). */
export const TOOL_ACTIVITY_LABEL: Record<string, string> = {
  whoami: "Se identificó",
  get_tonight: "Vio tu selección de Hoy",
  recommend: "Pidió recomendaciones",
  list_library: "Revisó tu biblioteca",
  get_title: "Abrió una ficha",
  list_diary: "Revisó tu diario",
  list_lists: "Revisó tus listas",
  get_list: "Abrió una lista",
  list_platform_arrivals: "Vio llegadas a tus plataformas",
  list_cinema: "Vio la cartelera",
  get_watch_together: "Buscó qué ver juntos",
  search: "Buscó en Filmia",
  fetch: "Abrió un resultado",
  add_to_library: "Agregó a tu biblioteca",
  set_title_status: "Cambió el estado de un título",
  mark_seen: "Marcó una vista",
  rate_title: "Calificó un título",
  create_list: "Creó una lista",
  add_to_list: "Agregó a una lista",
  remove_from_list: "Quitó de una lista",
};

export const toolActivityLabel = (tool: string) => TOOL_ACTIVITY_LABEL[tool] ?? tool;

export const TOOL_ERROR_LABEL: Record<string, string> = {
  unauthorized: "sin acceso",
  forbidden: "sin permiso",
  not_found: "no encontrado",
  validation: "datos inválidos",
  rate_limited: "demasiadas solicitudes",
  writes_disabled: "solo lectura",
  confirmation_required: "pidió confirmación",
  internal: "error",
};
