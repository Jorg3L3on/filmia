import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

/**
 * FIL-I9-1 · offline study for «% para ti». READ-ONLY: it never writes to the database.
 * For every user with enough rated watches and for every watch they rated (or put in
 * Favoritas), it rebuilds the taste profile WITHOUT that film, computes the affinity
 * features and asks: does the model predict «me gustó» (≥7 or Favoritas)? Reports AUC,
 * Brier and calibration buckets per variant, against IMDb alone.
 *
 *   npm run eval:affinity -- [--env=<path>] [--email=<a@b>] [--out=<file.md>] [--folds=5]
 */

const args = process.argv.slice(2);
const flag = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const envPath = flag("env");
if (envPath) {
  loadEnv({ path: envPath });
}
loadEnv({ path: ".env.local" });
loadEnv();

const FOLDS = Number(flag("folds") ?? 5);
/** The gate (Jorge, 2026-10-12): beat IMDb alone by this much AUC… */
const GATE_AUC_LIFT = 0.05;
/** …and stay within this many points in every bucket with enough rows. */
const GATE_MAX_GAP = 10;
const GATE_BUCKET_MIN_N = 15;
/** …with at least this many «no me gustó» rows behind the numbers… */
const GATE_MIN_NEGATIVES = 20;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL no está definida (usa --env=<ruta al .env>).");
}

type Variant = { name: string; halfLifeMonths: number | null; collectionBonus: number };
/** The variant the level study uses (flat recency, Jorge's lists as soft evidence). */
const LABEL_VARIANT: Variant = { name: "plana + listas", halfLifeMonths: null, collectionBonus: 0.3 };
const VARIANTS: Variant[] = [
  { name: "18 meses (Hoy)", halfLifeMonths: 18, collectionBonus: 0 },
  { name: "36 meses", halfLifeMonths: 36, collectionBonus: 0 },
  { name: "plana", halfLifeMonths: null, collectionBonus: 0 },
  { name: "36 meses + listas", halfLifeMonths: 36, collectionBonus: 0.3 },
  { name: "plana + listas", halfLifeMonths: null, collectionBonus: 0.3 },
];

const main = async () => {
  const { db } = await import("../src/db/index");
  const { loadTonightInput } = await import("../src/lib/tonight-store");
  const { librarySignature, evalKey } = await import("../src/lib/tonight/eval");
  const { clamp01, itemVector } = await import("../src/lib/tonight/features");
  const { GUSTO_SCALE } = await import("../src/lib/tonight");
  const {
    AFFINITY_MIN_RATED,
    FEATURE_ORDER,
    affinityFeatures,
    buildAffinityContext,
    featureArray,
    filmAsTitle,
    isLiked,
    likedTasteLeaveOneOut,
    quantile,
  } = await import("../src/lib/tonight/affinity");
  const { catalog } = await import("../src/db/index");
  const { parseStoredKeywords, parseStoredPeople } = await import("../src/lib/tonight-store");
  const { parseStoredTmdbGenres } = await import("../src/lib/diary-picks");
  const {
    auc,
    brier,
    calibrationBuckets,
    fitBins,
    fitLogistic,
    foldOf,
    maxCalibrationGap,
    predictLogistic,
  } = await import("../src/lib/tonight/affinity-eval");
  type CalibrationBucket = import("../src/lib/tonight/affinity-eval").CalibrationBucket;

  console.log(`Base de datos: ${new URL(process.env.DATABASE_URL!).host} (solo lectura)`);
  const now = new Date();

  const emailFilter = flag("email")?.toLowerCase();
  let userRows = await db.query.users.findMany({ columns: { id: true, email: true } });
  if (emailFilter) {
    userRows = userRows.filter((row) => row.email.toLowerCase() === emailFilter);
  }

  type Row = {
    user: number;
    x: number[];
    gusto: number;
    imdb: number;
    hasImdb: boolean;
    label: boolean;
    rating: number | null;
    favorite: boolean;
  };
  const rowsByVariant = new Map<string, Row[]>(VARIANTS.map((variant) => [variant.name, []]));
  const userStats: Array<{ user: number; rated: number; rows: number; liked: number; notLiked: number }> = [];
  const signatures = new Set<string>();
  let skippedClones = 0;
  let skippedThin = 0;
  const started = Date.now();

  // Films as Buscar sees them: enriched Catalog rows (keywords present), any user's.
  const catalogSample = (
    await db
      .select({
        id: catalog.id,
        tmdbId: catalog.tmdbId,
        name: catalog.name,
        kind: catalog.kind,
        year: catalog.year,
        imdbRating: catalog.imdbRating,
        imdbVotes: catalog.imdbVotes,
        tmdbGenres: catalog.tmdbGenres,
        tmdbKeywords: catalog.tmdbKeywords,
        tmdbPeople: catalog.tmdbPeople,
        originalLanguage: catalog.originalLanguage,
      })
      .from(catalog)
  )
    .map((row) => ({
      key: evalKey(row.kind, row.tmdbId),
      title: filmAsTitle({
        id: row.id,
        name: row.name,
        kind: row.kind,
        year: row.year,
        imdbRating: row.imdbRating,
        imdbVotes: row.imdbVotes,
        genres: parseStoredTmdbGenres(row.tmdbGenres),
        keywords: parseStoredKeywords(row.tmdbKeywords),
        people: parseStoredPeople(row.tmdbPeople),
        originalLanguage: row.originalLanguage,
      }),
    }))
    .filter((item) => item.title.keywords.length > 0);
  type LevelStudy = { user: number; liked: number[]; notLiked: number[]; unseen: number[]; fastLoo: number[] };
  const levelStudies: LevelStudy[] = [];

  for (const userRow of userRows) {
    const input = await loadTonightInput(userRow.id, now);
    const signature = librarySignature(input.rows.map((row) => evalKey(row.kind, row.tmdbId)));
    if (input.rows.length > 0 && signatures.has(signature)) {
      skippedClones += 1;
      continue;
    }
    signatures.add(signature);

    const titles = input.titles;
    const rated = titles.filter((title) => title.watchedAt != null && title.rating != null);
    if (rated.length < AFFINITY_MIN_RATED) {
      skippedThin += 1;
      continue;
    }
    const targets = titles.filter(
      (title) => title.watchedAt != null && (title.rating != null || isLiked(title)),
    );
    const user = userStats.length + 1;
    const liked = targets.filter(isLiked).length;
    userStats.push({ user, rated: rated.length, rows: targets.length, liked, notLiked: targets.length - liked });

    for (const variant of VARIANTS) {
      const bucket = rowsByVariant.get(variant.name)!;
      for (const target of targets) {
        const train = titles.filter((title) => title.id !== target.id);
        const events = input.events.filter((event) => event.titleId !== target.id);
        const ctx = buildAffinityContext(train, events, now, variant);
        const vector = itemVector(target);
        const features = affinityFeatures(ctx, target, vector);
        bucket.push({
          user,
          x: featureArray(features),
          gusto: clamp01(0.5 + features.taste * GUSTO_SCALE),
          imdb: features.quality,
          hasImdb: target.imdbRating != null,
          label: isLiked(target),
          rating: target.rating,
          favorite: target.listSlugs.includes("favoritas"),
        });
      }
    }
    {
      const variant = LABEL_VARIANT;
      const rows = rowsByVariant.get(variant.name)!.filter((row) => row.user === user);
      const ctx = buildAffinityContext(titles, input.events, now, variant);
      const owned = new Set(input.rows.map((row) => evalKey(row.kind, row.tmdbId)));
      levelStudies.push({
        user,
        liked: rows.filter((row) => row.label).map((row) => row.x[0]),
        notLiked: rows.filter((row) => !row.label).map((row) => row.x[0]),
        unseen: catalogSample
          .filter((item) => !owned.has(item.key))
          .map((item) => affinityFeatures(ctx, item.title).taste),
        fastLoo: likedTasteLeaveOneOut(ctx, titles, now, variant),
      });
    }
    console.log(`✓ usuario ${user}: ${rated.length} calificadas · ${targets.length} filas · ${liked} me gustó / ${targets.length - liked} no`);
  }

  if (userStats.length === 0) {
    console.log("Ningún usuario con datos suficientes.");
    return;
  }

  /** Out-of-fold predictions, so no row is scored by a model that saw it. */
  const outOfFold = (rows: Row[], fit: (train: Row[]) => (row: Row) => number) => {
    const predictions = new Array<number>(rows.length);
    for (let fold = 0; fold < FOLDS; fold += 1) {
      const train = rows.filter((_, index) => foldOf(index, FOLDS) !== fold);
      const predict = fit(train);
      rows.forEach((row, index) => {
        if (foldOf(index, FOLDS) === fold) {
          predictions[index] = predict(row);
        }
      });
    }
    return predictions;
  };

  const fitModel = (columns: number[]) => (train: Row[]) => {
    const model = fitLogistic(
      train.map((row) => columns.map((column) => row.x[column])),
      train.map((row) => row.label),
    );
    return (row: Row) => predictLogistic(model, columns.map((column) => row.x[column]));
  };
  const ALL = FEATURE_ORDER.map((_, index) => index);
  const QUALITY = FEATURE_ORDER.indexOf("quality");
  const BASE = FEATURE_ORDER.indexOf("base");

  type Scored = {
    name: string;
    auc: number | null;
    brier: number | null;
    buckets: CalibrationBucket[] | null;
    gap: number | null;
    perUser: Map<number, number | null>;
  };
  const score = (name: string, rows: Row[], values: number[], probabilistic: boolean): Scored => {
    const labels = rows.map((row) => row.label);
    const perUser = new Map<number, number | null>();
    for (const stat of userStats) {
      const idx = rows.flatMap((row, index) => (row.user === stat.user ? [index] : []));
      perUser.set(stat.user, auc(idx.map((i) => values[i]), idx.map((i) => labels[i])));
    }
    const buckets = probabilistic ? calibrationBuckets(values, labels) : null;
    return {
      name,
      auc: auc(values, labels),
      brier: probabilistic ? brier(values, labels) : null,
      buckets,
      gap: buckets ? maxCalibrationGap(buckets, GATE_BUCKET_MIN_N) : null,
      perUser,
    };
  };

  const results = VARIANTS.map((variant) => {
    const rows = rowsByVariant.get(variant.name)!;
    const prior = rows.filter((row) => row.label).length / rows.length;
    const imdb = score("IMDb solo (orden)", rows, rows.map((row) => row.imdb), false);
    const gusto = score("Gusto solo (orden)", rows, rows.map((row) => row.gusto), false);
    const model = score("(a) Logística, 6 rasgos", rows, outOfFold(rows, fitModel(ALL)), true);
    const imdbBase = score("IMDb + tasa base (logística)", rows, outOfFold(rows, fitModel([QUALITY, BASE])), true);
    const bins = score(
      "(b) Cubetas de gusto",
      rows,
      outOfFold(rows, (train) => {
        const map = fitBins(train.map((row) => row.gusto), train.map((row) => row.label), 8, prior);
        return (row) => map(row.gusto);
      }),
      true,
    );
    return { variant, rows, prior, imdb, gusto, model, imdbBase, bins };
  });

  // Chosen: lowest Brier among both mappings over every variant.
  const candidates = results.flatMap((result) => [
    { result, mapping: result.model, kind: "a" as const },
    { result, mapping: result.bins, kind: "b" as const },
  ]);
  candidates.sort((a, b) => (a.mapping.brier ?? 1) - (b.mapping.brier ?? 1));
  const chosen = candidates[0];
  const lift = (chosen.mapping.auc ?? 0) - (chosen.result.imdb.auc ?? 0);
  const gap = chosen.mapping.gap ?? 100;
  // Two more conditions the first run showed are needed: a percentage is only honest with
  // enough «no me gustó» to measure it, and if it beats «always say the base rate» on the
  // films you actually rated (unrated Favoritas are positive by definition).
  const negatives = chosen.result.rows.filter((row) => !row.label).length;
  const ratedRows = chosen.result.rows.filter((row) => row.rating != null);
  const ratedRate = ratedRows.filter((row) => row.label).length / Math.max(1, ratedRows.length);
  const ratedScore = score("rated", ratedRows, outOfFold(ratedRows, fitModel(ALL)), true);
  const ratedReference = ratedRate * (1 - ratedRate);
  const enoughNegatives = negatives >= GATE_MIN_NEGATIVES;
  const beatsBaseRate = (ratedScore.brier ?? 1) < ratedReference;
  const passes =
    lift >= GATE_AUC_LIFT && gap <= GATE_MAX_GAP && enoughNegatives && beatsBaseRate;

  const finalModel =
    chosen.kind === "a"
      ? fitLogistic(chosen.result.rows.map((row) => row.x), chosen.result.rows.map((row) => row.label))
      : null;

  const f2 = (value: number | null) => (value == null ? "—" : value.toFixed(3));
  const p0 = (value: number) => `${(value * 100).toFixed(0)}`;
  const lines: string[] = [];
  lines.push(`# Estudio de afinidad (FIL-I9-1) · ${now.toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    `Solo lectura. **${userStats.length}** usuarios con ≥${AFFINITY_MIN_RATED} vistas calificadas (${skippedClones} cuentas clonadas y ${skippedThin} con pocos datos omitidas). Cada fila es una vista calificada o en Favoritas, predicha con el perfil reconstruido **sin ella** (leave-one-out). Etiqueta «me gustó» = nota ≥ 7 (3.5★) o Favoritas. Las predicciones de los mapeos son fuera de pliegue (${FOLDS} pliegues), ningún modelo puntúa una fila que vio.`,
  );
  lines.push("");
  lines.push("## Compuerta");
  lines.push("");
  lines.push(`- Elegido (menor Brier): **${chosen.kind === "a" ? "(a) logística" : "(b) cubetas de gusto"}**, recencia **${chosen.result.variant.name}**.`);
  lines.push(`- AUC del elegido **${f2(chosen.mapping.auc)}** vs IMDb solo **${f2(chosen.result.imdb.auc)}**: lift **${lift >= 0 ? "+" : ""}${lift.toFixed(3)}** (umbral +${GATE_AUC_LIFT}).`);
  lines.push(`- Máxima desviación en cubetas con ≥${GATE_BUCKET_MIN_N} filas: **${gap.toFixed(1)} puntos** (umbral ±${GATE_MAX_GAP}).`);
  lines.push(`- Línea base más estricta, IMDb + tasa base del usuario: AUC ${f2(chosen.result.imdbBase.auc)}, Brier ${f2(chosen.result.imdbBase.brier)}.`);
  lines.push(`- Filas «no me gustó»: **${negatives}** (mínimo ${GATE_MIN_NEGATIVES}) → ${enoughNegatives ? "suficiente" : "**insuficiente**"}.`);
  lines.push(`- Solo vistas calificadas (${ratedRows.length}): Brier ${f2(ratedScore.brier)} vs ${f2(ratedReference)} de decir siempre la tasa base → ${beatsBaseRate ? "lo supera" : "**no lo supera**"}.`);
  lines.push(`- Veredicto: **${passes ? "PORCENTAJE" : "ETIQUETA DE TRES NIVELES"}**.`);
  lines.push("");
  lines.push("## Variantes (global)");
  lines.push("");
  lines.push("| Recencia | Filas | Tasa «me gustó» | AUC IMDb | AUC gusto | AUC (a) | Brier (a) | Desv. (a) | AUC (b) | Brier (b) | Desv. (b) | Brier IMDb+base |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const r of results) {
    lines.push(
      `| ${r.variant.name} | ${r.rows.length} | ${p0(r.prior)} % | ${f2(r.imdb.auc)} | ${f2(r.gusto.auc)} | ${f2(r.model.auc)} | ${f2(r.model.brier)} | ${r.model.gap?.toFixed(1)} | ${f2(r.bins.auc)} | ${f2(r.bins.brier)} | ${r.bins.gap?.toFixed(1)} | ${f2(r.imdbBase.brier)} |`,
    );
  }
  lines.push("");
  lines.push(`Brier de referencia (predecir siempre la tasa global): ${f2(chosen.result.prior * (1 - chosen.result.prior))}.`);
  lines.push("");
  lines.push(`## Calibración del elegido (${chosen.result.variant.name})`);
  lines.push("");
  lines.push("| Cubeta | Filas | Predicho | Observado | Desviación |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const b of chosen.mapping.buckets ?? []) {
    lines.push(
      `| ${b.from}–${b.from + 10} % | ${b.n} | ${p0(b.predicted)} % | ${p0(b.observed)} % | ${((b.observed - b.predicted) * 100).toFixed(1)} |`,
    );
  }
  lines.push("");
  lines.push("## Por usuario (variante elegida)");
  lines.push("");
  lines.push("| Usuario | Calificadas | Filas | Me gustó | No me gustó | AUC IMDb | AUC gusto | AUC elegido |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const stat of userStats) {
    lines.push(
      `| usuario ${stat.user} | ${stat.rated} | ${stat.rows} | ${stat.liked} | ${stat.notLiked} | ${f2(chosen.result.imdb.perUser.get(stat.user) ?? null)} | ${f2(chosen.result.gusto.perUser.get(stat.user) ?? null)} | ${f2(chosen.mapping.perUser.get(stat.user) ?? null)} |`,
    );
  }
  lines.push("");
  lines.push("Sesgo de selección: solo hay filas de películas que cada usuario eligió ver, así que la clase «no me gustó» es delgada (columna de arriba) y el número sobreestima la tasa para películas al azar.");
  // Sensitivity: the same features against stricter definitions of «me gustó».
  lines.push("");
  lines.push(`## Sensibilidad al umbral (recencia ${chosen.result.variant.name}, logística fuera de pliegue)`);
  lines.push("");
  lines.push("| «Me gustó» = | Filas | Sí | No | AUC IMDb | AUC gusto | AUC (a) | Brier (a) | Brier ref. | Desv. (a) |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const threshold of [7, 8, 9]) {
    const rows = chosen.result.rows
      .filter((row) => row.rating != null)
      .map((row) => ({ ...row, label: (row.rating ?? 0) >= threshold }));
    const yes = rows.filter((row) => row.label).length;
    const rate = yes / rows.length;
    const m = score("m", rows, outOfFold(rows, fitModel(ALL)), true);
    const i = score("i", rows, rows.map((row) => row.imdb), false);
    const g = score("g", rows, rows.map((row) => row.gusto), false);
    lines.push(
      `| nota ≥ ${threshold} (${threshold / 2}★), solo calificadas | ${rows.length} | ${yes} | ${rows.length - yes} | ${f2(i.auc)} | ${f2(g.auc)} | ${f2(m.auc)} | ${f2(m.brier)} | ${f2(rate * (1 - rate))} | ${m.gap?.toFixed(1)} |`,
    );
  }
  lines.push("");
  lines.push("Notas de las vistas calificadas (1–10, por usuario):");
  lines.push("");
  for (const stat of userStats) {
    const counts = new Map<number, number>();
    for (const row of chosen.result.rows) {
      if (row.user === stat.user && row.rating != null) {
        counts.set(row.rating, (counts.get(row.rating) ?? 0) + 1);
      }
    }
    const histogram = [...counts.entries()].sort((a, b) => a[0] - b[0]).map(([r, c]) => `${r}: ${c}`).join(" · ");
    lines.push(`- usuario ${stat.user}: ${histogram || "—"}`);
  }
  lines.push("");
  lines.push(`## Niveles: gusto (coseno) de lo que te gustó vs películas que no tienes (${LABEL_VARIANT.name})`);
  lines.push("");
  lines.push(`Catálogo de muestra: ${catalogSample.length} películas enriquecidas del Catalog compartido, menos las que cada usuario ya tiene. «LOO exacto» reconstruye el perfil; «LOO rápido» resta la contribución de la película (lo que calcula el servidor).`);
  lines.push("");
  lines.push("| Usuario | Me gustó p10 / p25 / p50 (exacto) | p10 / p50 (rápido) | No me gustó | No vistas p10 / p50 / p90 | No vistas ≥ p50 gustó | No vistas < p10 gustó |");
  lines.push("|---|---|---|---|---|---:|---:|");
  for (const study of levelStudies) {
    const q = (values: number[], at: number) => quantile(values, at).toFixed(2);
    const high = quantile(study.fastLoo, 0.5);
    const low = quantile(study.fastLoo, 0.1);
    const share = (pred: (v: number) => boolean) =>
      study.unseen.length === 0 ? "—" : `${p0(study.unseen.filter(pred).length / study.unseen.length)} %`;
    lines.push(
      `| usuario ${study.user} | ${q(study.liked, 0.1)} / ${q(study.liked, 0.25)} / ${q(study.liked, 0.5)} | ${q(study.fastLoo, 0.1)} / ${q(study.fastLoo, 0.5)} | ${study.notLiked.map((v) => v.toFixed(2)).join(", ") || "—"} | ${q(study.unseen, 0.1)} / ${q(study.unseen, 0.5)} / ${q(study.unseen, 0.9)} | ${share((v) => v >= high)} | ${share((v) => v < low)} |`,
    );
  }
  if (finalModel) {
    lines.push("");
    lines.push("## Modelo final (ajustado con todas las filas de la variante elegida)");
    lines.push("");
    lines.push("```json");
    lines.push(
      JSON.stringify(
        {
          halfLifeMonths: chosen.result.variant.halfLifeMonths,
          collectionBonus: chosen.result.variant.collectionBonus,
          intercept: Number(finalModel.intercept.toFixed(4)),
          weights: Object.fromEntries(FEATURE_ORDER.map((name, index) => [name, Number(finalModel.weights[index].toFixed(4))])),
        },
        null,
        2,
      ),
    );
    lines.push("```");
  }
  lines.push("");
  lines.push(`Duración: ${((Date.now() - started) / 1000).toFixed(1)} s.`);

  const report = lines.join("\n");
  console.log(`\n${report}`);
  const out = flag("out");
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, report);
    console.log(`\nInforme escrito en ${out}`);
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
