import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import * as ss from "simple-statistics";
import { numericValues } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.ols",
  name: "线性回归 (OLS)",
  category: "academic",
  subcategory: "regression",
  description: "系数表、R²、残差图",
  explanation: "非常经典的预测模型，可以拿一堆现象（特征）去预测一个数字（比如通过房子的面积、房龄来推测房价），并能告诉你到底谁的贡献大，谁扯了后腿。",
  inputSpec: [
    { id: "target", label: "因变量", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "predictors", label: "自变量", acceptedTypes: ["numeric"], min: 1 }
  ],
  paramSchema: [],
  citation: "Freedman, D.A. (2009)."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const yVar = variables["target"]?.[0];
  const predictors = variables["predictors"] || [];
  if (!yVar || predictors.length === 0) throw new Error("缺少变量");
  const y = numericValues(dataset, yVar);
  const X = predictors.map((p: string) => numericValues(dataset, p));
  const n = Math.min(...X.map((arr) => arr.length).concat([y.length]));
  const design = Array.from({ length: n }, (_, i) => [1, ...X.map((arr) => arr[i])]);
  const beta = ols(design, y.slice(0, n));
  const yHat = design.map((row) => dot(row, beta));
  const residuals = y.slice(0, n).map((val, i) => val - yHat[i]);
  const ssTotal = y.slice(0, n).reduce((a, b) => a + (b - mean(y)) ** 2, 0);
  const ssRes = residuals.reduce((a, b) => a + b ** 2, 0);
  const r2 = 1 - ssRes / ssTotal;
  const adjR2 = 1 - ((1 - r2) * (n - 1)) / (n - predictors.length - 1);
  const df = n - predictors.length - 1;
  const mse = ssRes / Math.max(df, 1);

  // Standard errors via (X'X)^-1 * MSE diagonal
  const Xt = transpose(design);
  const XtX = multiply(Xt, design);
  const XtXInv = invert2(XtX);
  const se = XtXInv.map((row, i) => Math.sqrt(Math.abs(row[i] * mse)));
  const tStats = beta.map((b, i) => b / Math.max(se[i], 1e-12));
  const pVals = tStats.map((t) => tDistCDF(Math.abs(t), df) * 2);

  const coeffRows = beta.map((b, i) => [
    i === 0 ? "截距" : predictors[i - 1],
    Number(b.toFixed(4)),
    Number(se[i].toFixed(4)),
    Number(tStats[i].toFixed(3)),
    Number(Math.min(1, pVals[i]).toFixed(4))
  ]);

  // Residual histogram bins
  const sorted = [...residuals].sort((a, b) => a - b);
  const mn = sorted[0], mx = sorted[sorted.length - 1];
  const bins = 20;
  const binW = (mx - mn) / bins || 1;
  const histCounts = Array(bins).fill(0);
  residuals.forEach((r) => {
    const idx = Math.min(bins - 1, Math.floor((r - mn) / binW));
    histCounts[idx]++;
  });
  const histLabels = Array.from({ length: bins }, (_, i) => Number((mn + (i + 0.5) * binW).toFixed(2)));

  const warnings: string[] = [];
  if (n < 30) warnings.push("样本量 < 30，回归结果可靠性有限");
  if (predictors.length >= n / 5) warnings.push("预测变量数量相对样本量较多，存在过拟合风险");

  const equation = buildEquation(beta, predictors);

  return {
    tables: [
      { title: "回归系数", columns: ["项", "估计 β", "标准误 SE", "t 值", "p值"], rows: coeffRows },
      { title: "拟合优度", columns: ["R²", "Adj.R²", "MSE", "n", "df"], rows: [[Number(r2.toFixed(3)), Number(adjR2.toFixed(3)), Number(mse.toFixed(3)), n, df]] }
    ],
    figures: [
      {
        title: "残差散点图（拟合值 vs 残差）",
        type: "echarts" as const,
        option: {
          xAxis: { type: "value", name: "拟合值" },
          yAxis: { type: "value", name: "残差" },
          series: [
            { type: "scatter", data: yHat.map((yh, i) => [yh, residuals[i]]), symbolSize: 5, itemStyle: { color: "#2f81f7", opacity: 0.7 } },
            { type: "line", data: [Math.min(...yHat), Math.max(...yHat)].map((v) => [v, 0]), lineStyle: { color: "#f85149", type: "dashed" } }
          ],
          tooltip: { trigger: "item" },
          grid: { left: 50, right: 20, top: 20, bottom: 40 }
        }
      },
      {
        title: "残差直方图",
        type: "echarts" as const,
        option: {
          xAxis: { type: "category", data: histLabels, name: "残差" },
          yAxis: { type: "value", name: "频数" },
          series: [{ type: "bar", data: histCounts, itemStyle: { color: "rgba(47,129,247,0.7)" } }],
          tooltip: { trigger: "axis" },
          grid: { left: 50, right: 20, top: 20, bottom: 50 }
        }
      }
    ],
    assumptions: ["线性、独立、正态、同方差（LIND）"],
    warnings,
    narrative: `回归方程解释 ${(r2 * 100).toFixed(1)}% 的因变量方差（R²=${r2.toFixed(3)}，Adj.R²=${adjR2.toFixed(3)}）。p 值 < 0.05 的系数统计显著。残差应随机分布于0附近。`,
    citation: spec.citation,
    extras: {
      regression: {
        type: "linear",
        equation,
        featureNames: predictors,
        coefficients: beta.slice(1),
        intercept: beta[0],
        scaler: null,
        metrics: { r2: Number(r2.toFixed(3)), rmse: Number(Math.sqrt(mse).toFixed(3)), mae: Number(ss.meanAbsoluteError ? ss.meanAbsoluteError(y.slice(0, n), yHat).toFixed(3) : NaN) },
        evaluation: regressionVerdict(r2, Math.sqrt(mse))
      }
    }
  };
}


function ols(X: number[][], y: number[]) {
  const Xt = transpose(X);
  const XtX = multiply(Xt, X);
  const XtXInv = invert2(XtX);
  const Xty = multiplyVec(Xt, y);
  return multiplyVec(XtXInv, Xty);
}

function transpose(m: number[][]) {
  return m[0].map((_, i) => m.map((row) => row[i]));
}

function multiply(a: number[][], b: number[][]) {
  const res: number[][] = Array.from({ length: a.length }, () => Array(b[0].length).fill(0));
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b[0].length; j++) {
      for (let k = 0; k < b.length; k++) {
        res[i][j] += a[i][k] * b[k][j];
      }
    }
  }
  return res;
}

function multiplyVec(a: number[][], v: number[]) {
  return a.map((row) => row.reduce((sum, val, i) => sum + val * v[i], 0));
}

function invert2(m: number[][]) {
  const size = m.length;
  const I = identity(size);
  const A = m.map((row, i) => [...row, ...I[i]]);
  for (let i = 0; i < size; i++) {
    let pivot = A[i][i];
    if (pivot === 0) pivot = 1e-8;
    for (let j = 0; j < 2 * size; j++) A[i][j] /= pivot;
    for (let r = 0; r < size; r++) {
      if (r === i) continue;
      const factor = A[r][i];
      for (let c = 0; c < 2 * size; c++) A[r][c] -= factor * A[i][c];
    }
  }
  return A.map((row) => row.slice(size));
}

function identity(n: number) {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
}

function dot(a: number[], b: number[]) {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);
}

function buildEquation(beta: number[], predictors: string[]) {
  const terms = predictors.map((p, i) => `${beta[i + 1] >= 0 ? "+" : ""}${beta[i + 1].toFixed(4)}·${p}`);
  const body = terms.join(" ");
  const b0 = beta[0] ? beta[0].toFixed(4) : "0";
  return `y = ${b0} ${body}`;
}

function regressionVerdict(r2: number, rmse: number) {
  if (r2 >= 0.8) return `模型表现优秀（R²=${r2.toFixed(3)}，RMSE=${rmse.toFixed(3)}）`;
  if (r2 >= 0.6) return `模型表现良好（R²=${r2.toFixed(3)}，RMSE=${rmse.toFixed(3)}）`;
  if (r2 >= 0.4) return `模型表现一般，建议补充特征或调参（R²=${r2.toFixed(3)}，RMSE=${rmse.toFixed(3)}）`;
  return `模型解释力较弱，需检查特征或数据质量（R²=${r2.toFixed(3)}，RMSE=${rmse.toFixed(3)}）`;
}

/** Approximate p-value from t-distribution: returns P(T > t) for df degrees of freedom */
function tDistCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  let cf = 1, d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d; cf = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let num = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    let delta = 1 + num * d;
    if (Math.abs(delta) < 1e-30) delta = 1e-30;
    d = 1 / delta; cf *= delta * d;
    num = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    delta = 1 + num * d;
    if (Math.abs(delta) < 1e-30) delta = 1e-30;
    d = 1 / delta;
    const prev = cf; cf *= delta * d;
    if (Math.abs(cf - prev) < 1e-8 * Math.abs(cf)) break;
  }
  return Math.min(1, Math.max(0, front * cf));
}

function lgamma(x: number): number {
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  const g = 7;
  if (x < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export default { spec, run };

