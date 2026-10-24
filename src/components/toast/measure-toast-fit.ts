import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Browser, Page } from "playwright";
import { ToastCard } from "@/components/Toast";
import type { ToastItem, ToastVariant } from "@/lib/toast";
import { TOAST_COPY, addedToNamedList } from "@/lib/toast-alerts";

const require = createRequire(import.meta.url);
const WIDTHS = [375, 390, 1280] as const;
const PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
const LONG_LIST = "CinematecaIberoamericanaDeLaFilmoteca";
const SERVER_WORD =
  "NoSePudoPersistirElCambioPorqueElServidorRespondioConUnIdentificadorDemasiadoLargo";

const root = process.cwd();

const geistFace = () => {
  const latin = readFileSync(
    path.join(root, "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2"),
  ).toString("base64");
  const latinExt = readFileSync(
    path.join(root, "node_modules/next/dist/next-devtools/server/font/geist-latin-ext.woff2"),
  ).toString("base64");
  return `
    @font-face {
      font-family: "Geist Fit";
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url(data:font/woff2;base64,${latin}) format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    @font-face {
      font-family: "Geist Fit";
      font-style: normal;
      font-weight: 100 900;
      font-display: block;
      src: url(data:font/woff2;base64,${latinExt}) format("woff2");
      unicode-range: U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF;
    }
  `;
};

const appCss = () => readFileSync(path.join(root, "src/app/globals.css"), "utf8").replace('@import "tailwindcss";\n', "");

const item = (
  id: number,
  variant: ToastVariant,
  title: string,
  description: string,
  extra: Partial<ToastItem> = {},
): ToastItem => ({
  id,
  title,
  description,
  variant,
  count: 1,
  durationMs: variant === "success" ? 4000 : variant === "info" ? 5000 : variant === "error" ? 8000 : null,
  remainingMs: variant === "success" ? 4000 : variant === "info" ? 5000 : variant === "error" ? 8000 : null,
  deadline: null,
  held: false,
  ...extra,
});

const card = (id: string, toast: ToastItem) =>
  `<div data-case="${id}" class="case">${renderToStaticMarkup(createElement(ToastCard, { toast, announce: false }))}</div>`;

const productionTitles = [
  ...new Set(Object.values(TOAST_COPY).filter((title) => title !== TOAST_COPY.retry)),
  "No se pudo copiar",
  "Añadidas a 3 listas",
];

const pageHtml = () => {
  const cases = [
    card(
      "error-action",
      item(1, "error", TOAST_COPY.couldNotSave, TOAST_COPY.retryHint, {
        durationMs: null,
        remainingMs: null,
        action: { label: TOAST_COPY.retry, onClick: () => {} },
      }),
    ),
    card(
      "error-long",
      item(
        2,
        "error",
        TOAST_COPY.couldNotSave,
        `${SERVER_WORD} ${TOAST_COPY.retryFailed} El servidor rechazó la ficha porque el identificador no está en el catálogo y la operación no se puede repetir desde aquí con los mismos datos.`,
      ),
    ),
    card("info", item(3, "info", TOAST_COPY.alreadyInactive, "")),
    card(
      "undo",
      item(4, "success", TOAST_COPY.neverSuggest, "Dune: Parte dos", {
        poster: PIXEL,
        action: { label: "Deshacer", onClick: () => {} },
        durationMs: 7000,
        remainingMs: 7000,
        held: true,
      }),
    ),
    card("dynamic", item(5, "success", addedToNamedList(LONG_LIST), "")),
    card(
      "progress",
      item(6, "progress", "Importando diario", "12 de 40 fichas", {
        progress: 0.45,
        durationMs: null,
        remainingMs: null,
      }),
    ),
    ...productionTitles.map((title, index) =>
      card(
        `title-${index}`,
        item(100 + index, "success", title, index % 2 === 0 ? "Dune: Parte dos" : "", {
          poster: PIXEL,
          action: { label: "Deshacer", onClick: () => {} },
          durationMs: 7000,
          remainingMs: 7000,
          held: true,
        }),
      ),
    ),
  ];

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${geistFace()}
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; background: #0e1114; }
  button, p { margin: 0; }
  button { font: inherit; color: inherit; background: transparent; border: 0; padding: 0; }
  ${appCss()}
  :root { --font-geist-sans: "Geist Fit", sans-serif; }
  #slot { width: 100%; max-width: 420px; }
  .case { margin-bottom: 8px; }
</style>
</head>
<body>
  <div id="host" style="width:100%;padding:0 16px;">
    <div id="slot">${cases.join("")}</div>
  </div>
</body>
</html>`;
};

type Measured = {
  id: string;
  title: string;
  lines: number;
  whiteSpace: string;
  overflowWrap: string;
  minWidth: string;
  scrollWidth: number;
  clientWidth: number;
  titleTop: number;
  titleBottom: number;
  titleLeft: number;
  titleRight: number;
  titleMid: number;
  subLines: number | null;
  subClamp: string | null;
  subClientHeight: number | null;
  subScrollHeight: number | null;
  subLineHeight: number | null;
  subRight: number | null;
  subOverflowWrap: string | null;
  subMinWidth: string | null;
  actionTop: number | null;
  actionHeight: number | null;
  actionHitW: number | null;
  actionHitH: number | null;
  leadMid: number | null;
  toastAlign: string;
  bodyAlign: string;
  bodyDirection: string;
  posterWidth: number | null;
  posterHeight: number | null;
  progressWidth: number | null;
  copyWidth: number | null;
  bodyWidth: number | null;
  toastLeft: number;
  toastRight: number;
  opacity: number;
  animating: boolean;
  font: string;
};

const measure = (page: Page) => page.evaluate(`(${MEASURE_JS})()`) as Promise<Measured[]>;

const MEASURE_JS = `() => {
  const scopes = Array.from(document.querySelectorAll("[data-case]"));
  return scopes.map((scope) => {
    const toast = scope.querySelector(".toast");
    const title = scope.querySelector(".toast-title");
    if (!toast || !title) throw new Error("missing toast in " + scope.dataset.case);
    const titleStyle = getComputedStyle(title);
    const titleBox = title.getBoundingClientRect();
    const toastBox = toast.getBoundingClientRect();
    const sub = scope.querySelector(".toast-sub");
    const action = scope.querySelector(".toast-action");
    const lead = scope.querySelector(".toast-icon, .toast-poster");
    const poster = scope.querySelector(".toast-poster");
    const progress = scope.querySelector(".toast-progress");
    const copy = scope.querySelector(".toast-copy");
    const body = scope.querySelector(".toast-body");
    const subStyle = sub ? getComputedStyle(sub) : null;
    const subBox = sub ? sub.getBoundingClientRect() : null;
    const actionBox = action ? action.getBoundingClientRect() : null;
    const after = action ? getComputedStyle(action, "::after") : null;
    const leadBox = lead ? lead.getBoundingClientRect() : null;
    const titleLine = parseFloat(titleStyle.lineHeight);
    const titleLines = !isFinite(titleLine) || titleLine <= 0 ? 1 : Math.max(1, Math.round(titleBox.height / titleLine));
    const subLine = subStyle ? parseFloat(subStyle.lineHeight) : null;
    const subLines = subBox && subLine && isFinite(subLine) && subLine > 0 ? Math.max(1, Math.round(subBox.height / subLine)) : null;
    let actionHitW = null;
    let actionHitH = null;
    if (actionBox && after) {
      const top = parseFloat(after.top);
      const right = parseFloat(after.right);
      const bottom = parseFloat(after.bottom);
      const left = parseFloat(after.left);
      actionHitW = actionBox.width - (isFinite(left) ? left : 0) - (isFinite(right) ? right : 0);
      actionHitH = actionBox.height - (isFinite(top) ? top : 0) - (isFinite(bottom) ? bottom : 0);
    }
    return {
      id: scope.dataset.case || "",
      title: title.textContent || "",
      lines: titleLines,
      whiteSpace: titleStyle.whiteSpace,
      overflowWrap: titleStyle.overflowWrap,
      minWidth: titleStyle.minWidth,
      scrollWidth: title.scrollWidth,
      clientWidth: title.clientWidth,
      titleTop: titleBox.top,
      titleBottom: titleBox.bottom,
      titleLeft: titleBox.left,
      titleRight: titleBox.right,
      titleMid: (titleBox.top + titleBox.bottom) / 2,
      subLines,
      subClamp: subStyle ? subStyle.getPropertyValue("-webkit-line-clamp") : null,
      subClientHeight: sub ? sub.clientHeight : null,
      subScrollHeight: sub ? sub.scrollHeight : null,
      subLineHeight: subLine,
      subRight: subBox ? subBox.right : null,
      subOverflowWrap: subStyle ? subStyle.overflowWrap : null,
      subMinWidth: subStyle ? subStyle.minWidth : null,
      actionTop: actionBox ? actionBox.top : null,
      actionHeight: actionBox ? actionBox.height : null,
      actionHitW,
      actionHitH,
      leadMid: leadBox ? (leadBox.top + leadBox.bottom) / 2 : null,
      toastAlign: getComputedStyle(toast).alignItems,
      bodyAlign: body ? getComputedStyle(body).alignItems : "",
      bodyDirection: body ? getComputedStyle(body).flexDirection : "",
      posterWidth: poster ? poster.getBoundingClientRect().width : null,
      posterHeight: poster ? poster.getBoundingClientRect().height : null,
      progressWidth: progress ? progress.getBoundingClientRect().width : null,
      copyWidth: copy ? copy.getBoundingClientRect().width : null,
      bodyWidth: body ? body.getBoundingClientRect().width : null,
      toastLeft: toastBox.left,
      toastRight: toastBox.right,
      opacity: Number(getComputedStyle(toast).opacity),
      animating: toast.getAnimations().some((animation) => animation.playState === "running"),
      font: titleStyle.fontFamily,
    };
  });
}`;

const near = (actual: number, expected: number, slack = 1) => Math.abs(actual - expected) <= slack;

const judge = (width: number, rows: Measured[]) => {
  const mobile = width < 640;
  const failures: string[] = [];
  const fail = (id: string, message: string) => failures.push(`${width}px ${id}: ${message}`);
  const byId = new Map(rows.map((row) => [row.id, row]));

  const expectRow = (id: string) => {
    const row = byId.get(id);
    if (!row) {
      fail(id, "missing");
    }
    return row;
  };

  for (const row of rows) {
    if (!row.font.includes("Geist Fit")) {
      fail(row.id, `font is ${row.font}`);
    }
    if (row.opacity < 0.85 || row.animating) {
      fail(row.id, `settled opacity ${row.opacity}, animating ${row.animating}`);
    }
    if (row.overflowWrap !== "anywhere" || row.minWidth !== "0px") {
      fail(row.id, `title wrap ${row.overflowWrap} min-width ${row.minWidth}`);
    }
    if (row.titleRight > row.toastRight + 1 || row.titleLeft < row.toastLeft - 1) {
      fail(row.id, `title escapes the card (${row.titleLeft}–${row.titleRight} vs ${row.toastLeft}–${row.toastRight})`);
    }
    if (row.subRight != null && row.subRight > row.toastRight + 1) {
      fail(row.id, "subtitle escapes the card");
    }
    if (row.subOverflowWrap != null && (row.subOverflowWrap !== "anywhere" || row.subMinWidth !== "0px")) {
      fail(row.id, `subtitle wrap ${row.subOverflowWrap} min-width ${row.subMinWidth}`);
    }
  }

  const errorAction = expectRow("error-action");
  const errorLong = expectRow("error-long");
  const info = expectRow("info");
  const undo = expectRow("undo");
  const dynamic = expectRow("dynamic");
  const progress = expectRow("progress");

  if (errorAction && errorLong && info && undo && dynamic && progress) {
    if (mobile) {
      if (errorAction.whiteSpace !== "normal" || errorAction.bodyDirection !== "column" || errorAction.bodyAlign !== "stretch") {
        fail("error-action", `layout ${errorAction.whiteSpace} ${errorAction.bodyDirection} ${errorAction.bodyAlign}`);
      }
      if (errorAction.actionTop == null || errorAction.actionTop < errorAction.titleBottom - 1) {
        fail("error-action", "Reintentar is not on the row below the title");
      }
      if (errorAction.toastAlign !== "flex-start") {
        fail("error-action", `toast align ${errorAction.toastAlign}`);
      }
    } else if (errorAction.actionTop == null || errorAction.actionTop >= errorAction.titleBottom) {
      fail("error-action", "Reintentar left the title row at desktop");
    } else if (errorAction.whiteSpace !== "nowrap" || errorAction.bodyDirection !== "row") {
      fail("error-action", `desktop layout changed (${errorAction.whiteSpace}, ${errorAction.bodyDirection})`);
    }

    for (const row of [errorAction, undo]) {
      if (row.actionHitW == null || row.actionHitH == null || row.actionHitW < 44 || row.actionHitH < 44) {
        fail(row.id, `touch target ${row.actionHitW}×${row.actionHitH}`);
      }
      const visible = mobile ? 28 : 32;
      if (row.actionHeight == null || !near(row.actionHeight, visible, 0.6)) {
        fail(row.id, `visible action height ${row.actionHeight}, expected ${visible}`);
      }
    }

    const clamp = mobile ? "3" : "2";
    if (errorLong.subClamp !== clamp) {
      fail("error-long", `line-clamp ${errorLong.subClamp}, expected ${clamp}`);
    }
    if (
      errorLong.subClientHeight == null ||
      errorLong.subLineHeight == null ||
      errorLong.subClientHeight > Number(clamp) * errorLong.subLineHeight + 2
    ) {
      fail("error-long", `subtitle height ${errorLong.subClientHeight}`);
    }
    if (
      errorLong.subScrollHeight == null ||
      errorLong.subClientHeight == null ||
      errorLong.subScrollHeight <= errorLong.subClientHeight + 1
    ) {
      fail("error-long", "long subtitle was not clamped");
    }

    if (info.lines !== 1 || info.toastAlign !== "center") {
      fail("info", `one line align ${info.toastAlign}, lines ${info.lines}`);
    }
    if (info.leadMid == null || Math.abs(info.leadMid - info.titleMid) > 2) {
      fail("info", `title mid ${info.titleMid} vs icon mid ${info.leadMid}`);
    }

    if (mobile) {
      if (dynamic.lines < 2 || dynamic.scrollWidth > dynamic.clientWidth + 1) {
        fail("dynamic", `long title lines ${dynamic.lines}, scroll ${dynamic.scrollWidth} client ${dynamic.clientWidth}`);
      }
      if (undo.posterWidth == null || !near(undo.posterWidth, 36) || !near(undo.posterHeight ?? 0, 50)) {
        fail("undo", `poster ${undo.posterWidth}×${undo.posterHeight}`);
      }
      if (undo.actionTop == null || undo.actionTop < undo.titleBottom - 1) {
        fail("undo", "Deshacer is not below the title");
      }
    } else if (undo.posterWidth == null || !near(undo.posterWidth, 40) || !near(undo.posterHeight ?? 0, 60)) {
      fail("undo", `desktop poster ${undo.posterWidth}×${undo.posterHeight}`);
    }

    if (
      progress.progressWidth == null ||
      progress.copyWidth == null ||
      progress.bodyWidth == null ||
      !near(progress.progressWidth, progress.copyWidth, 1) ||
      progress.copyWidth < progress.bodyWidth - 1
    ) {
      fail(
        "progress",
        `bar ${progress.progressWidth} copy ${progress.copyWidth} body ${progress.bodyWidth} align ${progress.bodyAlign}`,
      );
    }

    for (const row of rows) {
      if (!row.id.startsWith("title-")) {
        continue;
      }
      if (mobile) {
        if (row.lines > 2 || row.whiteSpace !== "normal" || row.scrollWidth > row.clientWidth + 1) {
          fail(row.id, `«${row.title}» lines ${row.lines} ${row.whiteSpace} scroll ${row.scrollWidth}/${row.clientWidth}`);
        }
        if (row.actionTop == null || row.actionTop < row.titleBottom - 1) {
          fail(row.id, `«${row.title}» action is not below the title`);
        }
      } else if (row.whiteSpace !== "nowrap" || row.actionTop == null || row.actionTop >= row.titleBottom) {
        fail(row.id, `«${row.title}» desktop row changed`);
      }
    }
  }

  return failures;
};

export const measureToastFit = async () => {
  const { chromium } = require("playwright") as {
    chromium: { launch: (options?: { headless?: boolean }) => Promise<Browser> };
  };
  const browser = await chromium.launch({ headless: true });
  const html = pageHtml();
  const failures: string[] = [];
  try {
    for (const width of WIDTHS) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      try {
        await page.setContent(html, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 700)));
        failures.push(...judge(width, await measure(page)));
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length > 0) {
    throw new Error(failures.join("\n"));
  }
};
