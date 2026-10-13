/**
 * FIL-I9-1 · maths for the affinity study: ranking quality (AUC), probability quality
 * (Brier, calibration buckets) and a small L2 logistic regression. Pure; the script
 * `scripts/eval-affinity.ts` does the I/O.
 */

/** Area under the ROC curve (Mann–Whitney, ties count half). `null` with one class only. */
export const auc = (scores: readonly number[], labels: readonly boolean[]): number | null => {
  const items = scores.map((score, index) => ({ score, label: labels[index] }));
  const positives = items.filter((item) => item.label).length;
  const negatives = items.length - positives;
  if (positives === 0 || negatives === 0) {
    return null;
  }
  items.sort((a, b) => a.score - b.score);
  let rankSumPositives = 0;
  let index = 0;
  while (index < items.length) {
    let end = index;
    while (end + 1 < items.length && items[end + 1].score === items[index].score) {
      end += 1;
    }
    const averageRank = (index + end) / 2 + 1;
    for (let k = index; k <= end; k += 1) {
      if (items[k].label) {
        rankSumPositives += averageRank;
      }
    }
    index = end + 1;
  }
  return (rankSumPositives - (positives * (positives + 1)) / 2) / (positives * negatives);
};

/** Mean squared error of a probability against the 0/1 outcome. */
export const brier = (probabilities: readonly number[], labels: readonly boolean[]) => {
  if (probabilities.length === 0) {
    return 0;
  }
  let sum = 0;
  probabilities.forEach((p, index) => {
    const y = labels[index] ? 1 : 0;
    sum += (p - y) * (p - y);
  });
  return sum / probabilities.length;
};

export type CalibrationBucket = {
  /** Lower edge, 0–90 in steps of 10 (percentage points). */
  from: number;
  n: number;
  predicted: number;
  observed: number;
};

/** Ten buckets of 10 points: mean predicted vs observed rate. Empty buckets are left out. */
export const calibrationBuckets = (
  probabilities: readonly number[],
  labels: readonly boolean[],
): CalibrationBucket[] => {
  const sums = Array.from({ length: 10 }, () => ({ n: 0, p: 0, y: 0 }));
  probabilities.forEach((p, index) => {
    const bucket = Math.min(9, Math.max(0, Math.floor(p * 10)));
    sums[bucket].n += 1;
    sums[bucket].p += p;
    sums[bucket].y += labels[index] ? 1 : 0;
  });
  return sums.flatMap((sum, bucket) =>
    sum.n === 0
      ? []
      : [{ from: bucket * 10, n: sum.n, predicted: sum.p / sum.n, observed: sum.y / sum.n }],
  );
};

/**
 * Worst gap (points, 0–100) between predicted and observed among buckets with at least
 * `minN` rows; thin buckets are noise, not miscalibration.
 */
export const maxCalibrationGap = (buckets: readonly CalibrationBucket[], minN = 15) => {
  let worst = 0;
  for (const bucket of buckets) {
    if (bucket.n >= minN) {
      worst = Math.max(worst, Math.abs(bucket.predicted - bucket.observed) * 100);
    }
  }
  return worst;
};

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
export const logit = (p: number) => {
  const q = Math.min(1 - 1e-6, Math.max(1e-6, p));
  return Math.log(q / (1 - q));
};

/** Weights in the features' own scale: p = sigmoid(intercept + Σ w·x). */
export type LogisticModel = { intercept: number; weights: number[] };

export const predictLogistic = (model: LogisticModel, x: readonly number[]) => {
  let z = model.intercept;
  model.weights.forEach((weight, index) => {
    z += weight * x[index];
  });
  return sigmoid(z);
};

/**
 * L2-regularized logistic regression by full-batch gradient descent on standardized
 * features; the result is rescaled back to the raw features. Small and deterministic.
 */
export const fitLogistic = (
  rows: readonly (readonly number[])[],
  labels: readonly boolean[],
  { lambda = 0.01, iterations = 3000, rate = 0.5 } = {},
): LogisticModel => {
  const n = rows.length;
  const d = rows[0]?.length ?? 0;
  if (n === 0) {
    return { intercept: 0, weights: Array.from({ length: d }, () => 0) };
  }
  const means = Array.from({ length: d }, (_, j) => rows.reduce((s, r) => s + r[j], 0) / n);
  const stds = Array.from({ length: d }, (_, j) => {
    const variance = rows.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / n;
    return Math.sqrt(variance) || 1;
  });
  const z = rows.map((r) => r.map((value, j) => (value - means[j]) / stds[j]));
  const y = labels.map((label) => (label ? 1 : 0));

  let b = logit(y.reduce((s: number, v) => s + v, 0) / n);
  const w = Array.from({ length: d }, () => 0);
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let gb = 0;
    const gw = Array.from({ length: d }, () => 0);
    for (let i = 0; i < n; i += 1) {
      let s = b;
      for (let j = 0; j < d; j += 1) {
        s += w[j] * z[i][j];
      }
      const error = sigmoid(s) - y[i];
      gb += error;
      for (let j = 0; j < d; j += 1) {
        gw[j] += error * z[i][j];
      }
    }
    b -= (rate * gb) / n;
    for (let j = 0; j < d; j += 1) {
      w[j] -= rate * (gw[j] / n + lambda * w[j]);
    }
  }

  const weights = w.map((wj, j) => wj / stds[j]);
  const intercept = b - weights.reduce((s, wj, j) => s + wj * means[j], 0);
  return { intercept, weights };
};

/** Deterministic k-fold assignment (round robin over a stable order). */
export const foldOf = (index: number, folds: number) => index % folds;

/**
 * Bucket calibration of one score: cut the training scores into `bins` quantiles and
 * map each to its observed rate (Laplace-smoothed toward `prior`).
 */
export const fitBins = (
  scores: readonly number[],
  labels: readonly boolean[],
  bins = 8,
  prior = 0.5,
) => {
  const sorted = [...scores].sort((a, b) => a - b);
  const edges = Array.from({ length: bins - 1 }, (_, k) =>
    sorted[Math.floor(((k + 1) * sorted.length) / bins)] ?? 0,
  );
  const binOf = (score: number) => {
    let bin = 0;
    while (bin < edges.length && score >= edges[bin]) {
      bin += 1;
    }
    return bin;
  };
  const counts = Array.from({ length: bins }, () => ({ n: 0, y: 0 }));
  scores.forEach((score, index) => {
    const bin = binOf(score);
    counts[bin].n += 1;
    counts[bin].y += labels[index] ? 1 : 0;
  });
  const rates = counts.map((count) => (count.y + 2 * prior) / (count.n + 2));
  return (score: number) => rates[binOf(score)];
};
