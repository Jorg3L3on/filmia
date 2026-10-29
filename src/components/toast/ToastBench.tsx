"use client";

import { useState } from "react";
import { Sheet, SheetHandle } from "@/components/Sheet";
import { ToastCard } from "@/components/Toast";
import { toastContrastSamples } from "@/lib/toast-contrast";
import { showToast, type ToastItem } from "@/lib/toast";
import { TOAST_COPY } from "@/lib/toast-alerts";
import { btnPrimary, btnSecondary, focusRing } from "@/lib/ui";

const noop = () => {};

const fixture = (
  id: number,
  variant: ToastItem["variant"],
  title: string,
  description: string,
  extra: Partial<ToastItem> = {},
): ToastItem => ({
  id,
  title,
  description,
  variant,
  count: 1,
  durationMs: variant === "success" ? 4000 : variant === "info" ? 5000 : null,
  remainingMs: variant === "success" ? 4000 : variant === "info" ? 5000 : null,
  deadline: null,
  held: false,
  ...extra,
});

const FIXTURES: ToastItem[] = [
  fixture(9101, "success", "Añadida a tu diario", "Dune: Parte dos", {
    poster: "/filmia-mark.png",
    action: { label: "Deshacer", onClick: noop },
    durationMs: 7000,
    remainingMs: 7000 * 0.62,
    deadline: null,
    held: true,
  }),
  fixture(9102, "info", "Nueva temporada", "Estación once · ya está en casa"),
  fixture(9103, "progress", "Importando diario", "12 de 40 fichas", { progress: 0.45 }),
  fixture(9104, "warning", "Sin conexión", "Se guardará cuando vuelva la red"),
  fixture(9105, "error", "No se pudo guardar", "Puedes volver a intentarlo.", {
    action: { label: "Reintentar", onClick: noop },
  }),
];

/** Static, fictional samples for the FIL-I28 review. Not production calls. */
const ZONE_BOARDS: { id: string; label: string; items: ToastItem[] }[] = [
  {
    id: "zona-a",
    label: "Zona (a) · Diario y ficha",
    items: [
      fixture(9201, "success", "Añadida a tu diario", "Dune: Parte dos", {
        poster: "/filmia-mark.png",
        action: { label: "Deshacer", onClick: noop },
        durationMs: 7000,
        remainingMs: 7000,
        held: true,
      }),
      fixture(9202, "error", "No se pudo quitar", "Puedes volver a intentarlo.", {
        poster: "/filmia-mark.png",
        action: { label: "Reintentar", onClick: noop },
        durationMs: null,
        remainingMs: null,
      }),
      fixture(9203, "success", "Nota guardada", "Aftersun", { poster: "/filmia-mark.png" }),
    ],
  },
  {
    id: "zona-b",
    label: "Zona (b) · Hoy y Quiero ver",
    items: [
      fixture(9211, "success", "Reservada para esta noche", "Aftersun", {
        poster: "/filmia-mark.png",
        action: { label: "Ver en Hoy", onClick: noop },
      }),
      fixture(9212, "success", "Ahora no", "Aftersun vuelve en dos semanas.", {
        poster: "/filmia-mark.png",
        action: { label: "Deshacer", onClick: noop },
        durationMs: 7000,
        remainingMs: 7000,
        held: true,
      }),
      fixture(9213, "error", "No se pudo guardar", "Puedes volver a intentarlo.", {
        poster: "/filmia-mark.png",
        action: { label: "Reintentar", onClick: noop },
        durationMs: null,
        remainingMs: null,
      }),
      fixture(9214, "success", "No te la volveremos a sugerir", "Dune: Parte dos", {
        poster: "/filmia-mark.png",
        action: { label: "Deshacer", onClick: noop },
        durationMs: 7000,
        remainingMs: 7000,
        held: true,
      }),
    ],
  },
  {
    id: "zona-c",
    label: "Zona (c) · Listas y compartidas",
    items: [
      fixture(9221, "success", "Añadida a la lista", "Dune: Parte dos", { poster: "/filmia-mark.png" }),
      fixture(9222, "error", "No se pudo agregar", "Puedes volver a intentarlo.", {
        poster: "/filmia-mark.png",
        action: { label: "Reintentar", onClick: noop },
        durationMs: null,
        remainingMs: null,
      }),
      fixture(9223, "success", "Top guardado", "Tu top 6 de 2024", { poster: "/filmia-mark.png" }),
      fixture(9224, "success", "Lista eliminada", ""),
      fixture(9225, "success", "Salida confirmada", ""),
    ],
  },
  {
    id: "zona-d",
    label: "Zona (d) · Onboarding, perfil y compartir",
    items: [
      fixture(9231, "success", "Añadida a Quiero ver", "", { count: 3 }),
      fixture(9232, "error", "No se pudo guardar", "Esa película no está en el catálogo.", {
        poster: "/filmia-mark.png",
        durationMs: 8000,
        remainingMs: 8000,
      }),
      fixture(9233, "info", "Ya no estaba activa.", ""),
      fixture(9234, "success", "Enlace copiado", "Pégalo donde quieras compartirlo."),
      fixture(9235, "success", "Conexión cerrada", "Carta"),
    ],
  },
];

const POSITIONS = [
  {
    id: "movil",
    label: "Móvil · 12 px sobre el dock",
    bottom: "bottom-[5.5rem]",
  },
  {
    id: "escritorio",
    label: "Escritorio · 32 px, ancho 420",
    bottom: "bottom-8",
  },
  {
    id: "buscar",
    label: "Buscar · dock arriba, 1.5 rem",
    bottom: "bottom-6",
  },
] as const;

/** Production titles, minus the button label. The fit board renders each one at the page width. */
const FIT_TITLES = [
  ...new Set(Object.values(TOAST_COPY).filter((title) => title !== TOAST_COPY.retry)),
  "No se pudo copiar",
  "Añadidas a 3 listas",
];

const FIT_SUBS = [
  "Aftersun vuelve en dos semanas.",
  "Puedes volver a intentarlo.",
  "Pégalo donde quieras compartirlo.",
  "Se está guardando la fecha vista.",
];

const SHEETS = [
  { id: "listas", title: "Agregar a listas", primary: "Guardar" },
  { id: "nota", title: "Nota", primary: "Guardar nota" },
  { id: "visto", title: "Marcar como vista", primary: "Añadir al diario" },
] as const;

type SheetId = (typeof SHEETS)[number]["id"];

export const ToastBench = () => {
  const [sheet, setSheet] = useState<SheetId | null>(null);
  const [plate, setPlate] = useState<"glass" | "solid" | "contrast">("glass");
  const rows = toastContrastSamples();

  const handleShow = (variant: ToastItem["variant"]) => {
    const sample = FIXTURES.find((item) => item.variant === variant);
    if (!sample) {
      return;
    }
    showToast({
      title: sample.title,
      description: sample.description,
      variant,
      poster: sample.poster,
      progress: sample.progress,
      action: sample.action ? { label: sample.action.label, onClick: noop } : undefined,
    });
  };

  const handleOpenSheet = (id: SheetId) => {
    setSheet(id);
    const found = SHEETS.find((item) => item.id === id);
    showToast({
      title: found ? `${found.title} lista` : "Hoja abierta",
      description: "El aviso sube para no tapar el botón.",
      action: { label: "Deshacer", onClick: noop },
    });
  };

  const handlePlate = (next: "glass" | "solid" | "contrast") => {
    setPlate(next);
  };

  const handleReduce = () => {
    document.documentElement.classList.toggle("toast-force-reduce");
  };

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-accent">FIL-I27</p>
        <h1 className="font-serif text-3xl text-paper">Banco de alertas · Cristal sala</h1>
        <p className="max-w-2xl text-sm text-fog">
          Cinco tipos por tres posiciones. Solo existe en desarrollo; en producción esta ruta no está.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {FIXTURES.map((item) => (
          <button
            key={item.variant}
            type="button"
            className={btnSecondary}
            onClick={() => handleShow(item.variant)}
          >
            {item.variant}
          </button>
        ))}
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            showToast({ title: "Añadida a la lista", description: "Para ver en casa" });
            showToast({ title: "Nota guardada", description: "Dune: Parte dos" });
            showToast({ title: "Añadida a Quiero ver", description: "Aftersun" });
          }}
        >
          Pila de 3
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => {
            showToast({ title: "Añadida a Quiero ver", poster: "/posters/dune.jpg" });
            showToast({ title: "Añadida a Quiero ver", poster: "/posters/aftersun.jpg" });
            showToast({ title: "Añadida a Quiero ver", poster: "/posters/carta.jpg" });
          }}
        >
          Ráfaga · Dune, Aftersun y Carta
        </button>
        <button
          type="button"
          className={btnSecondary}
          onClick={() => showToast({ title: "No se pudo guardar", variant: "error" })}
        >
          Mismo error
        </button>
        <button type="button" className={btnSecondary} onClick={handleReduce}>
          Fundido 120 ms
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {ZONE_BOARDS.map((zone) => (
          <section key={zone.id} id={zone.id} aria-label={zone.label} className="space-y-2">
            <h2 className="text-sm font-semibold text-paper">{zone.label}</h2>
            <div className="flex flex-col gap-2 rounded-[28px] border border-white/10 bg-canvas p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              {zone.items.map((item) => (
                <ToastCard key={item.id} toast={item} announce={false} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="flex flex-col items-center gap-8">
        {POSITIONS.map((position) => (
          <section key={position.id} aria-label={position.label} className="w-full max-w-[420px] space-y-2">
            <h2 className="text-sm font-semibold text-paper">{position.label}</h2>
            <div
              className={`relative h-[720px] overflow-hidden rounded-[28px] border border-white/10 bg-canvas ${position.id === "escritorio" ? "w-[420px] max-w-full" : "w-full"}`}
            >
              {position.id === "buscar" ? (
                <div className="absolute inset-x-3 top-3 h-12 rounded-full border border-white/15 bg-white/10" />
              ) : null}
              <div className={`absolute inset-x-3 flex flex-col gap-2 ${position.bottom}`}>
                {FIXTURES.map((item) => (
                  <ToastCard key={item.id} toast={item} announce={false} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>

      <section id="toast-fit" aria-label="Copy sin elipsis" className="space-y-2">
        <h2 className="text-sm font-semibold text-paper">Copy real · el título cabe a 375</h2>
        <div className="flex flex-col gap-2 rounded-[28px] border border-white/10 bg-canvas p-3">
          {FIT_TITLES.map((title, index) => (
            <ToastCard
              key={title}
              announce={false}
              toast={fixture(9300 + index, "success", title, index < FIT_SUBS.length ? FIT_SUBS[index] : "", {
                poster: "/filmia-mark.png",
                action: { label: "Deshacer", onClick: noop },
                durationMs: 7000,
                remainingMs: 7000,
                held: true,
              })}
            />
          ))}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="contraste-avisos">
        <h2 id="contraste-avisos" className="text-sm font-semibold text-paper">
          Contraste medido (composición del cristal)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={plate === "glass" ? btnPrimary : btnSecondary} onClick={() => handlePlate("glass")}>
            Cristal
          </button>
          <button type="button" className={plate === "solid" ? btnPrimary : btnSecondary} onClick={() => handlePlate("solid")}>
            Sólido
          </button>
          <button type="button" className={plate === "contrast" ? btnPrimary : btnSecondary} onClick={() => handlePlate("contrast")}>
            Más contraste
          </button>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className={`rounded-2xl bg-white p-3 ${plate === "solid" ? "toast-force-solid" : ""} ${plate === "contrast" ? "toast-force-contrast" : ""}`}>
            <ToastCard toast={FIXTURES[0]} announce={false} />
          </div>
          <div className="rounded-2xl p-3" style={{ background: "rgb(230 50 80)" }}>
            <ToastCard toast={FIXTURES[1]} announce={false} />
          </div>
          <div
            className="rounded-2xl p-3"
            style={{ background: "linear-gradient(135deg, rgb(240 200 80), rgb(180 70 30))" }}
          >
            <ToastCard toast={FIXTURES[4]} announce={false} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-fog">
            <thead>
              <tr className="text-paper">
                <th className="py-2 pr-3 font-semibold">Superficie</th>
                <th className="py-2 pr-3 font-semibold">Título</th>
                <th className="py-2 pr-3 font-semibold">Subtítulo</th>
                <th className="py-2 pr-3 font-semibold">Acción</th>
                <th className="py-2 pr-3 font-semibold">Cerrar</th>
                <th className="py-2 pr-3 font-semibold">Borde</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.surface} className="border-t border-white/10">
                  <td className="py-2 pr-3 text-paper">{row.surface}</td>
                  <td className="py-2 pr-3">{row.title.toFixed(2)}:1</td>
                  <td className="py-2 pr-3">{row.subtitle.toFixed(2)}:1</td>
                  <td className="py-2 pr-3">{row.action.toFixed(2)}:1</td>
                  <td className="py-2 pr-3">{row.close.toFixed(2)}:1</td>
                  <td className="py-2 pr-3">{row.edge.toFixed(2)}:1</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="hojas-avisos">
        <h2 id="hojas-avisos" className="text-sm font-semibold text-paper">
          Tres hojas · el aviso sube
        </h2>
        <div className="flex flex-wrap gap-2">
          {SHEETS.map((item) => (
            <button key={item.id} type="button" className={btnPrimary} onClick={() => handleOpenSheet(item.id)}>
              {item.title}
            </button>
          ))}
        </div>
      </section>

      {SHEETS.map((item) => (
        <Sheet key={item.id} open={sheet === item.id} onClose={() => setSheet(null)} label={item.title}>
          <SheetHandle />
          <h2 className="font-serif text-2xl text-paper">{item.title}</h2>
          <p className="mt-2 text-sm text-fog">Una ficha de ejemplo. El botón de abajo tiene que quedar libre.</p>
          <div className="mt-6">
            <button type="button" className={`${btnPrimary} w-full`} onClick={() => setSheet(null)}>
              {item.primary}
            </button>
          </div>
        </Sheet>
      ))}

      <p className="text-xs text-faint">
        <kbd className={focusRing}>Alt</kbd>+<kbd className={focusRing}>T</kbd> lleva a la región. Esc cierra el aviso más nuevo.
      </p>
    </div>
  );
};
