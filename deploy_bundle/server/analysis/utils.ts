import * as ss from "simple-statistics";
import { ColumnMeta } from "@statlab/shared";

export type DataRow = Record<string, any>;

export function numericValues(data: DataRow[], column: string): number[] {
  return data
    .map((row) => Number(row[column]))
    .filter((v) => !isNaN(v) && isFinite(v));
}

export function categoricalCounts(data: DataRow[], column: string) {
  const counts: Record<string, number> = {};
  data.forEach((row) => {
    const key = String(row[column] ?? "missing");
    counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
}

export function inferType(values: any[]): ColumnMeta["type"] {
  const numericCount = values.filter((v) => !isNaN(Number(v))).length;
  return numericCount / Math.max(values.length, 1) > 0.7 ? "numeric" : "categorical";
}

export function safeMean(values: number[]) {
  return values.length ? ss.mean(values) : NaN;
}

export function safeSd(values: number[]) {
  return values.length ? ss.standardDeviation(values) : NaN;
}

export function safeMedian(values: number[]) {
  return values.length ? ss.median(values) : NaN;
}

export function safeSkew(values: number[]) {
  return values.length ? ss.sampleSkewness(values) : NaN;
}

export function safeKurt(values: number[]) {
  return values.length ? ss.sampleKurtosis(values) : NaN;
}

export function quartiles(values: number[]) {
  if (!values.length) return { q1: NaN, q3: NaN };
  const sorted = [...values].sort((a, b) => a - b);
  return {
    q1: ss.quantileSorted(sorted, 0.25),
    q3: ss.quantileSorted(sorted, 0.75)
  };
}

export function variance(values: number[]) {
  return values.length ? ss.variance(values) : NaN;
}

export function corr(x: number[], y: number[]) {
  if (x.length !== y.length || x.length === 0) return NaN;
  return ss.sampleCorrelation(x, y);
}

export function covariance(x: number[], y: number[]) {
  if (x.length !== y.length || x.length === 0) return NaN;
  return ss.sampleCovariance(x, y);
}

export function spearmanCorr(x: number[], y: number[]) {
  const rank = (arr: number[]) =>
    arr
      .map((v, i) => ({ v, i }))
      .sort((a, b) => a.v - b.v)
      .map((item, _idx, sorted) => {
        const ties = sorted.filter((s) => s.v === item.v).map((s) => sorted.indexOf(s));
        const avgRank = ties.reduce((a, b) => a + b, 0) / ties.length;
        return { i: item.i, r: avgRank + 1 };
      })
      .sort((a, b) => a.i - b.i)
      .map((item) => item.r);

  const rx = rank(x);
  const ry = rank(y);
  const n = Math.min(rx.length, ry.length);
  const mean = (arr: number[]) => arr.slice(0, n).reduce((a, b) => a + b, 0) / Math.max(n, 1);
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

export function kendallTau(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  let concordant = 0, discordant = 0, ties = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = x[j] - x[i];
      const dy = y[j] - y[i];
      if (dx === 0 || dy === 0) { ties++; continue; }
      const prod = dx * dy;
      if (prod > 0) concordant++;
      else if (prod < 0) discordant++;
    }
  }
  const denom = concordant + discordant;
  return denom === 0 ? 0 : (concordant - discordant) / denom;
}

export function winsorize(values: number[], alpha = 0.05) {
  if (!values.length) return [] as number[];
  const sorted = [...values].sort((a, b) => a - b);
  const loIdx = Math.floor(alpha * (sorted.length - 1));
  const hiIdx = Math.ceil((1 - alpha) * (sorted.length - 1));
  const lo = sorted[loIdx];
  const hi = sorted[hiIdx];
  return values.map((v) => Math.max(lo, Math.min(hi, v)));
}

// ─── ML Prep Helpers ───────────────────────────────────────────────────────
export type ScaleMode = "standard" | "minmax" | "none";

export type FeaturePipeline = {
  numFeats: string[];
  catFeats: string[];
  oneHot: boolean;
  numImputeValues: Record<string, number>;
  catImputeValues: Record<string, string>;
  oheMap: Record<string, string[]>;
  labelMap: Record<string, Record<string, number>>;
  finalFeatureNames: string[];
};

export type StoredScaler = {
  mode: ScaleMode;
  means: number[];
  stds: number[];
  mins: number[];
  maxs: number[];
};

/**
 * Approximate SHAP-like feature importance (model-agnostic, fast):
 * For each feature i, replace it with baseline value and measure mean |delta| on predictions.
 */
export async function computeShapLikeImportanceAsync(
  X: number[][],
  featureNames: string[],
  predict: (mat: number[][]) => number[] | Promise<number[]>,
  baseline?: number[]
) {
  if (!X.length) return featureNames.map((f) => ({ feature: f, importance: 0 }));
  const sample = X.slice(0, 200);
  const dim = featureNames.length;
  const base = baseline && baseline.length === dim
    ? baseline
    : Array.from({ length: dim }, (_, j) => {
      const vals = sample.map((r) => r[j]).filter((v) => Number.isFinite(v));
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    });

  // baseline prediction once
  const baseArray = await predict(sample);
  const basePred = (Array.isArray(baseArray) ? [...baseArray] : Array.from(baseArray || [])) as number[];
  const acc = Array(dim).fill(0);

  for (let j = 0; j < dim; j++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const perturbed = sample.map((row) => {
      const copy = [...row];
      copy[j] = base[j];
      return copy;
    });
    const pertArray = await predict(perturbed);
    const predPerturb = (Array.isArray(pertArray) ? [...pertArray] : Array.from(pertArray || [])) as number[];
    for (let i = 0; i < predPerturb.length; i++) {
      const delta = Math.abs((basePred[i] ?? 0) - (predPerturb[i] ?? 0));
      acc[j] += delta;
    }
  }

  const norm = sample.length || 1;
  return featureNames.map((f, j) => ({ feature: f, importance: Number((acc[j] / norm).toFixed(6)) }));
}

export function processMLFeatures(dataset: any[], feats: string[], impute: string, oneHot: boolean) {
  const catFeats: string[] = [];
  const numFeats: string[] = [];

  feats.forEach(f => {
    const vals = dataset.map(r => r[f]).filter(v => v !== null && v !== undefined && v !== "");
    const numCount = vals.filter(v => !isNaN(Number(v))).length;
    if (numCount / Math.max(vals.length, 1) < 0.7) catFeats.push(f);
    else numFeats.push(f);
  });

  const numImputeValues: Record<string, number> = {};
  numFeats.forEach(f => {
    const vals = dataset.map((r: any) => Number(r[f])).filter((v: number) => !isNaN(v));
    let val = 0;
    if (impute === "mean") val = safeMean(vals) || 0;
    else if (impute === "median") val = safeMedian(vals) || 0;
    numImputeValues[f] = val;
  });

  const catImputeValues: Record<string, string> = {};
  catFeats.forEach(f => {
    const counts = categoricalCounts(dataset, f);
    delete counts["missing"];
    delete counts["null"];
    const mode = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || "Unknown";
    catImputeValues[f] = mode;
  });

  const finalFeatureNames: string[] = [...numFeats];
  const oheMap: Record<string, string[]> = {};
  const labelMap: Record<string, Record<string, number>> = {};

  catFeats.forEach(f => {
    const rawUnique = new Set(dataset.map((r: any) => {
      const v = String(r[f] ?? "");
      return v === "" || v === "null" ? catImputeValues[f] : v;
    }));
    const uniqueVals = Array.from(rawUnique).filter(v => v !== "missing" && v !== "null");

    if (oneHot) {
      oheMap[f] = uniqueVals;
      uniqueVals.forEach(v => finalFeatureNames.push(`${f}_${v}`));
    } else {
      labelMap[f] = {};
      uniqueVals.forEach((v, i) => labelMap[f][v] = i);
      finalFeatureNames.push(f);
    }
  });

  const extractX = (row: any) => {
    const x: number[] = [];
    numFeats.forEach(f => {
      const v = Number(row[f]);
      x.push(isNaN(v) ? numImputeValues[f] : v);
    });
    catFeats.forEach(f => {
      let v = String(row[f] ?? "");
      if (v === "" || v === "null") v = catImputeValues[f];
      if (oneHot) {
        oheMap[f].forEach(uv => x.push(v === uv ? 1 : 0));
      } else {
        x.push(labelMap[f][v] ?? 0);
      }
    });
    return x;
  };

  const pipeline: FeaturePipeline = {
    numFeats,
    catFeats,
    oneHot,
    numImputeValues,
    catImputeValues,
    oheMap,
    labelMap,
    finalFeatureNames
  };

  return { extractX, finalFeatureNames, catFeats, pipeline };
}

/**
 * Apply stored pipeline (impute + encoding) to raw rows and return design matrix (no scaling).
 */
export function transformWithPipeline(rows: any[], pipeline: FeaturePipeline) {
  const X: number[][] = [];
  rows.forEach((row) => {
    const x: number[] = [];
    pipeline.numFeats.forEach((f) => {
      const v = Number(row?.[f]);
      x.push(isNaN(v) ? pipeline.numImputeValues[f] : v);
    });
    pipeline.catFeats.forEach((f) => {
      let v = String(row?.[f] ?? "");
      if (v === "" || v === "null") v = pipeline.catImputeValues[f];
      if (pipeline.oneHot) {
        (pipeline.oheMap[f] || []).forEach((uv) => x.push(v === uv ? 1 : 0));
      } else {
        x.push(pipeline.labelMap?.[f]?.[v] ?? 0);
      }
    });
    X.push(x);
  });
  return { X, finalFeatureNames: pipeline.finalFeatureNames };
}

/**
 * Apply a stored scaler onto an existing matrix (in place clone).
 */
export function applyStoredScaler(X: number[][], scaler?: StoredScaler | null) {
  if (!scaler || !X.length) return X;
  const mode = scaler.mode || "none";
  if (mode === "none") return X;
  return X.map((row) => row.map((v, i) => {
    if (mode === "standard") {
      const sd = scaler.stds?.[i] || 1;
      const mean = scaler.means?.[i] || 0;
      return (v - mean) / (sd || 1);
    }
    if (mode === "minmax") {
      const min = scaler.mins?.[i] ?? 0;
      const max = scaler.maxs?.[i] ?? 1;
      const range = max - min || 1;
      return (v - min) / range;
    }
    return v;
  }));
}

export function splitAndScale(
  rows: { x: number[]; y: number }[],
  testSize = 0.3,
  scale: ScaleMode = "standard"
) {
  if (!rows.length) return { trainX: [], trainY: [], testX: [], testY: [], scaler: null as any };
  const split = Math.max(1, Math.floor(rows.length * (1 - testSize)));
  const train = rows.slice(0, split);
  const test = rows.slice(split);
  const trainX = train.map((r) => [...r.x]);
  const trainY = train.map((r) => r.y);
  const testX = test.map((r) => [...r.x]);
  const testY = test.map((r) => r.y);

  if (scale !== "none" && trainX.length) {
    const cols = trainX[0].length;
    const means = Array(cols).fill(0);
    const stds = Array(cols).fill(0);
    const mins = Array(cols).fill(Infinity);
    const maxs = Array(cols).fill(-Infinity);

    trainX.forEach((row) => {
      row.forEach((v, i) => {
        means[i] += v;
        mins[i] = Math.min(mins[i], v);
        maxs[i] = Math.max(maxs[i], v);
      });
    });
    means.forEach((_, i) => { means[i] /= trainX.length; });
    trainX.forEach((row) => {
      row.forEach((v, i) => { stds[i] += (v - means[i]) ** 2; });
    });
    stds.forEach((_, i) => { stds[i] = Math.sqrt(stds[i] / Math.max(trainX.length, 1)) || 1; });

    const applyScale = (mat: number[][]) => {
      mat.forEach((row) => {
        row.forEach((v, i) => {
          if (scale === "standard") {
            row[i] = (v - means[i]) / stds[i];
          } else if (scale === "minmax") {
            const range = maxs[i] - mins[i] || 1;
            row[i] = (v - mins[i]) / range;
          }
        });
      });
    };

    applyScale(trainX);
    applyScale(testX);

    return { trainX, trainY, testX, testY, scaler: { mode: scale, means, stds, mins, maxs } };
  }

  const cols = trainX[0]?.length || 0;
  return { trainX, trainY, testX, testY, scaler: { mode: scale, means: Array(cols).fill(0), stds: Array(cols).fill(1), mins: Array(cols).fill(0), maxs: Array(cols).fill(0) } };
}

export function biweightMidcorrelation(x: number[], y: number[]) {
  const bx = biweightTransform(x);
  const by = biweightTransform(y);
  return corr(bx, by);
}

function biweightTransform(arr: number[]) {
  if (!arr.length) return [] as number[];
  const m = ss.median(arr);
  const mad = ss.median(arr.map((v) => Math.abs(v - m))) || 1e-8;
  const u = arr.map((v) => (v - m) / (9 * mad));
  return u.map((ui, i) => {
    if (Math.abs(ui) >= 1) return 0;
    const w = (1 - ui ** 2) ** 2;
    return (arr[i] - m) * w;
  });
}

export function distanceCorrelation(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  if (n < 2) return NaN;
  const ax = doubleCenter(distanceMatrix(x.slice(0, n)));
  const ay = doubleCenter(distanceMatrix(y.slice(0, n)));
  const dcov = meanProduct(ax, ay);
  const dvarx = meanProduct(ax, ax);
  const dvary = meanProduct(ay, ay);
  if (dvarx <= 0 || dvary <= 0) return 0;
  return dcov / Math.sqrt(dvarx * dvary);
}

function distanceMatrix(vec: number[]) {
  const n = vec.length;
  const m: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const d = Math.abs(vec[i] - vec[j]);
      m[i][j] = d; m[j][i] = d;
    }
  }
  return m;
}

function doubleCenter(mat: number[][]) {
  const n = mat.length;
  const rowMeans = mat.map((row) => row.reduce((a, b) => a + b, 0) / Math.max(n, 1));
  const colMeans = Array.from({ length: n }, (_, j) => mat.reduce((a, row) => a + row[j], 0) / Math.max(n, 1));
  const totalMean = mat.flat().reduce((a, b) => a + b, 0) / Math.max(n * n, 1);
  return mat.map((row, i) => row.map((val, j) => val - rowMeans[i] - colMeans[j] + totalMean));
}

function meanProduct(a: number[][], b: number[][]) {
  const n = a.length;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) sum += a[i][j] * b[i][j];
  }
  return sum / Math.max(n * n, 1);
}

export function partialCorrelationMatrix(data: DataRow[], vars: string[]) {
  const n = data.length;
  const k = vars.length;
  if (k < 2) return { rho: [[]], vars };
  const matrix = vars.map((v) => numericValues(data, v).slice(0, n));
  // Correlation matrix
  const corrMat: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    corrMat[i][i] = 1;
    for (let j = i + 1; j < k; j++) {
      const r = corr(matrix[i], matrix[j]);
      corrMat[i][j] = r; corrMat[j][i] = r;
    }
  }
  // Invert (simple Gauss-Jordan); fallback to identity on failure
  const inv = invertMatrix(corrMat) || identity(k);
  const rho = Array.from({ length: k }, () => Array(k).fill(0));
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i === j) { rho[i][j] = 1; continue; }
      rho[i][j] = -inv[i][j] / Math.sqrt(Math.max(inv[i][i] * inv[j][j], 1e-12));
    }
  }
  return { rho, vars };
}

function identity(n: number) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? 1 : 0)));
}

function invertMatrix(mat: number[][]) {
  const n = mat.length;
  const a = mat.map((row) => [...row]);
  const inv = identity(n);
  for (let i = 0; i < n; i++) {
    let pivot = a[i][i];
    let pivotRow = i;
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(a[r][i]) > Math.abs(pivot)) { pivot = a[r][i]; pivotRow = r; }
    }
    if (Math.abs(pivot) < 1e-10) return null;
    if (pivotRow !== i) { [a[i], a[pivotRow]] = [a[pivotRow], a[i]];[inv[i], inv[pivotRow]] = [inv[pivotRow], inv[i]]; }
    const factor = a[i][i];
    for (let j = 0; j < n; j++) { a[i][j] /= factor; inv[i][j] /= factor; }
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = a[r][i];
      for (let c = 0; c < n; c++) {
        a[r][c] -= f * a[i][c];
        inv[r][c] -= f * inv[i][c];
      }
    }
  }
  return inv;
}

/** Kolmogorov-Smirnov one-sample test against N(0,1) with p-value approximation */
export function ksNormalTest(values: number[]) {
  const n = values.length;
  if (n < 2) return { D: NaN, p: NaN };
  const mean = safeMean(values);
  const sd = safeSd(values);
  if (!isFinite(mean) || !isFinite(sd) || sd === 0) return { D: 0, p: 1 };
  const z = [...values].sort((a, b) => a - b).map((v) => (v - mean) / sd);
  let D = 0;
  for (let i = 0; i < n; i++) {
    const F = normalCDF(z[i]);
    const empUpper = (i + 1) / n;
    const empLower = i / n;
    D = Math.max(D, Math.abs(F - empUpper), Math.abs(F - empLower));
  }
  const p = ksPValue(D, n);
  return { D, p };
}

function ksPValue(D: number, n: number) {
  if (isNaN(D) || n <= 0) return NaN;
  const x = (Math.sqrt(n) + 0.12 + 0.11 / Math.sqrt(n)) * D;
  // Survival function for Kolmogorov distribution
  let sum = 0;
  for (let k = 1; k < 100; k++) {
    const term = Math.exp(-2 * k * k * x * x);
    sum += (k % 2 ? 1 : -1) * term * 2;
    if (term < 1e-8) break;
  }
  return Math.max(0, Math.min(1, sum));
}

/**
 * Shapiro-Wilk W 统计量近似实现（Based on Royston 1992 normality approximation）
 * 对于 n < 5000 的小样本给出 W 和近似 p 值（优于之前的占位符）
 */
export function shapiroWilk(values: number[]) {
  const n = values.length;
  if (n < 3) return { W: NaN, p: NaN };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = safeMean(sorted);
  const sd = safeSd(sorted);
  if (sd === 0) return { W: 1, p: 1 };

  // Normalize to z-scores
  const z = sorted.map((x) => (x - mean) / sd);

  // Compute expected order statistics from standard normal (Blom approximation)
  const m = z.map((_, i) => {
    const p = (i + 1 - 0.375) / (n + 0.25);
    return normalQuantile(p);
  });
  const mSum2 = m.reduce((a, b) => a + b * b, 0);

  // Coefficient approximation (a_i = m_i / sqrt(mSum2))
  const a = m.map((mi) => mi / Math.sqrt(mSum2));

  // W statistic
  const numerator = a.reduce((sum, ai, i) => sum + ai * sorted[i], 0);
  const denominator = sorted.reduce((sum, x) => sum + (x - mean) ** 2, 0);
  const W = denominator === 0 ? 1 : Math.min(1, (numerator * numerator) / denominator);

  // p value approximation via log transformation (Royston 1992)
  const mu = -1.2725 + 1.0521 * Math.log(n);
  const sigma = 1.0308 - 0.26763 * Math.log(n);
  const y = Math.log(1 - W);
  const z_stat = (y - mu) / sigma;
  const p = 1 - normalCDF(z_stat);

  return { W: Number(W.toFixed(4)), p: Number(Math.max(0, Math.min(1, p)).toFixed(4)) };
}

/** Standard normal CDF (Abramowitz & Stegun approximation) */
function normalCDF(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}

/** Standard normal quantile (probit) via rational approximation */
function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [2.515517, 0.802853, 0.010328];
  const b = [1.432788, 0.189269, 0.001308];
  const t = p < 0.5 ? Math.sqrt(-2 * Math.log(p)) : Math.sqrt(-2 * Math.log(1 - p));
  const num = a[0] + a[1] * t + a[2] * t * t;
  const den = 1 + b[0] * t + b[1] * t * t + b[2] * t * t * t;
  const z = t - num / den;
  return p < 0.5 ? -z : z;
}

export { normalCDF, normalQuantile };

export function chiSquareTest(counts: number[][]) {
  const rows = counts.length;
  const cols = counts[0].length;
  const rowTotals = counts.map((row) => row.reduce((a, b) => a + b, 0));
  const colTotals = counts[0].map((_, j) => counts.reduce((a, row) => a + row[j], 0));
  const total = rowTotals.reduce((a, b) => a + b, 0);
  let chi = 0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const expected = (rowTotals[i] * colTotals[j]) / total;
      if (expected > 0) chi += ((counts[i][j] - expected) ** 2) / expected;
    }
  }
  const df = (rows - 1) * (cols - 1);
  return { chi2: chi, df };
}

export function cronbachAlpha(matrix: number[][]) {
  const k = matrix[0]?.length || 0;
  if (k < 2) return NaN;
  const itemVariances = [] as number[];
  const totalScores = [] as number[];
  for (let i = 0; i < matrix.length; i++) {
    const row = matrix[i];
    totalScores.push(row.reduce((a, b) => a + b, 0));
    for (let j = 0; j < k; j++) {
      if (!itemVariances[j]) itemVariances[j] = 0;
    }
  }
  for (let j = 0; j < k; j++) {
    const vals = matrix.map((row) => row[j]);
    itemVariances[j] = variance(vals);
  }
  const totalVar = variance(totalScores);
  const sumItemVar = itemVariances.reduce((a, b) => a + b, 0);
  return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}
