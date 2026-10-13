import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  auc,
  brier,
  calibrationBuckets,
  fitBins,
  fitLogistic,
  maxCalibrationGap,
  predictLogistic,
} from "./tonight/affinity-eval";

describe("tonight/affinity-eval", () => {
  it("AUC is 1 for a perfect ranking, 0.5 for ties and null with one class", () => {
    assert.equal(auc([0.1, 0.2, 0.8, 0.9], [false, false, true, true]), 1);
    assert.equal(auc([0.9, 0.8, 0.2, 0.1], [false, false, true, true]), 0);
    assert.equal(auc([0.5, 0.5, 0.5, 0.5], [false, true, false, true]), 0.5);
    assert.equal(auc([0.1, 0.2], [true, true]), null);
  });

  it("Brier is the mean squared error", () => {
    assert.equal(brier([1, 0], [true, false]), 0);
    assert.equal(brier([0.5, 0.5], [true, false]), 0.25);
  });

  it("buckets compare predicted and observed by tenths and the gap ignores thin ones", () => {
    const p = [0.05, 0.05, 0.95, 0.95, 0.95, 0.95];
    const y = [false, false, true, true, true, false];
    const buckets = calibrationBuckets(p, y);
    assert.deepEqual(buckets.map((b) => [b.from, b.n]), [[0, 2], [90, 4]]);
    assert.equal(buckets[1].observed, 0.75);
    assert.ok(Math.abs(maxCalibrationGap(buckets, 4) - 20) < 1e-9);
    assert.equal(maxCalibrationGap(buckets, 5), 0);
  });

  it("logistic regression learns the sign and stays in the raw feature scale", () => {
    const rows: number[][] = [];
    const labels: boolean[] = [];
    for (let i = 0; i < 200; i += 1) {
      const x = (i % 20) / 2 - 5;
      rows.push([x * 10, 1]);
      labels.push(x + ((i * 7) % 3) - 1 > 0);
    }
    const model = fitLogistic(rows, labels);
    assert.ok(model.weights[0] > 0);
    assert.ok(predictLogistic(model, [40, 1]) > 0.9);
    assert.ok(predictLogistic(model, [-40, 1]) < 0.1);
  });

  it("bins map higher scores to higher observed rates", () => {
    const scores = Array.from({ length: 80 }, (_, i) => i / 80);
    const labels = scores.map((s) => s > 0.5);
    const map = fitBins(scores, labels, 4, 0.5);
    assert.ok(map(0.9) > 0.8);
    assert.ok(map(0.1) < 0.2);
  });
});
