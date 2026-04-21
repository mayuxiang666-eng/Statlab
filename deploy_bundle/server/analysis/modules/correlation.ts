import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, corr, spearmanCorr } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.correlation",
  name: "相关分析",
  category: "academic",
  subcategory: "相关性分析",
  description: "Pearson & Spearman + 热力图 + p值，支持焦点变量",
  explanation: "最经典的线性相关（Pearson）和排序相关（Spearman）。它可以帮你快速找出一堆变量里，哪些是同向增长（正相关），哪些是此消彼长（负相关）。配套红蓝相间的热力图，颜色越深代表关系越铁。",
  inputSpec: [
    { id: "variables", label: "变量（自动识别数值/分类型）", acceptedTypes: ["numeric", "categorical", "text"], min: 2 }
  ],
  paramSchema: [
    { key: "focusVar", label: "目标变量（仅输出与该变量的关联）", type: "select", default: "", options: [{ label: "—— 全部配对 ——", value: "" }] }
  ],
  citation: "Cohen, J. (1988). Statistical power analysis."
};

async function run({ dataset, variables, params }: any): Promise<AnalysisResult> {
  const allVarsRaw: string[] = variables["variables"] || [];
  // 自动识别类型：数值占比 >50% 视为数值型，其余视为分类型
  const numVars: string[] = [];
  const catVars: string[] = [];
  allVarsRaw.forEach((v) => {
    const vals = dataset.map((r: any) => r?.[v]).filter((x: any) => x !== null && x !== undefined);
    const numericCount = vals.filter((x: any) => !isNaN(Number(x))).length;
    const ratio = vals.length === 0 ? 0 : numericCount / vals.length;
    if (ratio >= 0.5) numVars.push(v); else catVars.push(v);
  });
  const allVars: string[] = [...numVars, ...catVars];
  const focusVar: string = (params?.focusVar || "").trim();
  const rows: (string | number | null)[][] = [];
  const pairMeta: { pair: [string, string]; metric: number; type: "numeric" | "categorical" | "mixed" }[] = [];

  // Determine which pairs to compute
  const pairs: [string, string][] = [];
  if (focusVar && allVars.includes(focusVar)) {
    // Only correlations between focusVar and the other vars
    for (const v of allVars) {
      if (v !== focusVar) pairs.push([focusVar, v]);
    }
  } else {
    for (let i = 0; i < allVars.length; i++)
      for (let j = i + 1; j < allVars.length; j++)
        pairs.push([allVars[i], allVars[j]]);
  }

  for (const [v1, v2] of pairs) {
    const type1 = numVars.includes(v1) ? "numeric" : "categorical";
    const type2 = numVars.includes(v2) ? "numeric" : "categorical";

    if (type1 === "numeric" && type2 === "numeric") {
      const x = numericValues(dataset, v1);
      const y = numericValues(dataset, v2);
      const n = Math.min(x.length, y.length);
      const pearson = corr(x, y);
      const spearman = spearmanCorr(x, y);
      const tStat = n > 2 ? pearson * Math.sqrt((n - 2) / Math.max(1e-12, 1 - pearson ** 2)) : NaN;
      const pVal = isNaN(tStat) ? null : Math.min(1, Math.max(0, 2 * (1 - tDistCDF(Math.abs(tStat), n - 2))));
      rows.push([
        `${v1} × ${v2}`,
        Number(pearson.toFixed(3)),
        Number(spearman.toFixed(3)),
        n,
        pVal === null ? "—" : Number(pVal.toFixed(4))
      ]);
      if (!isNaN(pearson)) pairMeta.push({ pair: [v1, v2], metric: pearson, type: "numeric" });
    } else if (type1 === "categorical" && type2 === "categorical") {
      const { v, n } = cramersV(dataset, v1, v2);
      rows.push([
        `${v1} × ${v2}`,
        Number(v.toFixed(3)),
        "—",
        n,
        "—"
      ]);
      if (!isNaN(v)) pairMeta.push({ pair: [v1, v2], metric: v, type: "categorical" });
    } else {
      // Mixed numeric-categorical: 相关比 (eta)
      const numVar = type1 === "numeric" ? v1 : v2;
      const catVar = type1 === "categorical" ? v1 : v2;
      const { eta, n } = correlationRatio(dataset, catVar, numVar);
      rows.push([
        `${v1} × ${v2}`,
        Number(eta.toFixed(3)),
        "—",
        n,
        "—"
      ]);
      if (!isNaN(eta)) pairMeta.push({ pair: [v1, v2], metric: eta, type: "mixed" });
    }
  }

  // Heatmap: if focusVar is set, show only that row
  const heatVarsBase = focusVar && numVars.includes(focusVar)
    ? [focusVar, ...numVars.filter((v: string) => v !== focusVar)]
    : numVars;
  const heatVars = heatVarsBase;

  const heatSource = heatVars.map((v1: string) =>
    heatVars.map((v2: string) => {
      if (v1 === v2) return 1;
      const x = numericValues(dataset, v1);
      const y = numericValues(dataset, v2);
      return Number(corr(x, y).toFixed(3));
    })
  );

  // If focusVar, additionally build a bar chart of correlations sorted by |r|
  const focusFigures: any[] = [];
  if (focusVar && allVars.includes(focusVar)) {
    const barData = pairs
      .map(([v1, v2]) => {
        const other = v1 === focusVar ? v2 : v1;
        const r = rows.find((row) => row[0] === `${v1} × ${v2}`);
        return { name: other, r: r ? Number(r[1]) : 0 };
      })
      .sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    focusFigures.push({
      title: `${focusVar} 与各变量的相关性`,
      type: "echarts" as const,
      option: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "value", min: -1, max: 1, axisLine: { onZero: true } },
        yAxis: { type: "category", data: barData.map((d) => d.name), axisLabel: { interval: 0 } },
        series: [{
          type: "bar",
          data: barData.map((d) => ({
            value: d.r,
            itemStyle: { color: d.r >= 0 ? "#2f81f7" : "#f85149" }
          })),
          label: { show: true, position: "right", formatter: (p: any) => Number(p.value).toFixed(3) }
        }],
        grid: { left: 10, right: 60, top: 10, bottom: 10, containLabel: true }
      }
    });
  }

  const numericTableVars = numVars;

  return {
    tables: [
      { title: "相关/关联结果", columns: ["配对", "Pearson/Cramér/η", "Spearman", "n", "p值"], rows },
      buildInterpretationTable(pairMeta, dataset, numVars),
      numericTableVars.length >= 2 ? buildSymmetricTable(numericTableVars, rows) : null,
      buildExplanationTable()
    ].filter(Boolean) as any,
    figures: [
      ...focusFigures,
      ...buildScatterFigures(dataset, pairMeta),
      ...buildCategoricalFigures(dataset, pairMeta, numVars),
      heatVars.length >= 2 ? {
        title: "相关热力图 (数值变量)",
        type: "echarts" as const,
        option: {
          tooltip: {
            formatter: (p: any) => `${heatVars[p.value[1]]} × ${heatVars[p.value[0]]}: ${p.value[2]}`
          },
          xAxis: {
            type: "category", data: heatVars,
            axisLabel: { rotate: 45, interval: 0, overflow: "truncate", width: 80 }
          },
          yAxis: {
            type: "category", data: heatVars,
            axisLabel: { interval: 0, overflow: "truncate", width: 90 }
          },
          visualMap: {
            min: -1, max: 1,
            orient: "horizontal", left: "center", bottom: 0,
            inRange: { color: ["#f85149", "#f0f6ff", "#2f81f7"] }
          },
          dataZoom: [
            { type: "inside", xAxisIndex: 0 },
            { type: "inside", yAxisIndex: 0 },
            { type: "slider", xAxisIndex: 0, height: 18, bottom: 24 },
            { type: "slider", yAxisIndex: 0, width: 18, right: 4 }
          ],
          series: [{
            type: "heatmap",
            data: heatSource.flatMap((row: number[], i: number) =>
              row.map((v: number, j: number) => [j, i, v])
            ),
            label: { show: true, formatter: (p: any) => Number(p.value[2]).toFixed(2), fontSize: 11 }
          }],
          grid: { left: 10, right: 30, top: 10, bottom: 50, containLabel: true }
        }
      } : null
    ].filter(Boolean) as any,
    assumptions: ["线性关系、无极端离群值", "样本量 ≥ 10 时 p 值才可靠"],
    warnings: allVars.length > 8 ? ["变量较多，注意多重比较问题（建议 Bonferroni 校正）"] : [],
    narrative: buildNarrative(allVars, pairs.length, focusVar),
    citation: spec.citation
  };
}

function buildExplanationTable() {
  return {
    title: "分析步骤与图表说明",
    columns: ["要点", "说明"],
    rows: [
      [
        "分析流程",
        "1) 先检验显著性：p<0.05 认为存在统计相关；2) 看系数正负与大小：正值同向、负值反向，|r|≈0.1/0.3/0.5 约对应弱/中/强；3) 若设焦点变量，关注其与他变量的排序条形图。"
      ],
      [
        "热力图解读",
        "颜色越深相关绝对值越大，对角线为1。可拖动/缩放查看局部，适合快速识别强相关块。"
      ],
      [
        "显著性标记",
        "表格内使用 (* p<0.10, ** p<0.05, *** p<0.01)。p值基于双尾检验。"
      ],
      [
        "注意事项",
        "相关不代表因果；若存在离群或非线性关系，建议结合 Spearman / Kendall / 稳健/距离/偏相关等其他算法交叉验证。分类变量支持 Cramér's V（分类-分类）与相关比η（分类-数值）。"
      ]
    ]
  };
}

function buildInterpretationTable(meta: { pair: [string, string]; metric: number; type: "numeric" | "categorical" | "mixed" }[], dataset?: any[], numVars: string[] = []) {
  if (meta.length === 0) return null;
  const rows = meta.map(({ pair, metric, type }) => {
    const strength = describeStrength(metric);
    const direction = type === "numeric" ? (metric > 0 ? "正向" : metric < 0 ? "反向" : "无明显") : "关联";
    let detail: string;
    if (type === "numeric") {
      detail = `相关系数 ${metric.toFixed(3)}，${strength}，${direction}关系`;
    } else if (type === "mixed" && dataset) {
      const catVar = numVars.includes(pair[0]) ? pair[1] : pair[0];
      const numVar = numVars.includes(pair[0]) ? pair[0] : pair[1];
      const stats = categoryMean(dataset, catVar, numVar, 3);
      const top = stats.labels.map((lbl, i) => `${lbl}: ${stats.means[i]} (n=${stats.counts[i]})`).join("; ");
      detail = `关联比 η=${metric.toFixed(3)}，${strength}。高均值Top: ${top}`;
    } else if (type === "categorical" && dataset) {
      const ct = crossTab(dataset, pair[0], pair[1], 6, 6);
      const samples = Array.from(ct.counts.entries())
        .map(([k, v]) => ({ k, v }))
        .sort((a, b) => b.v - a.v)
        .slice(0, 3)
        .map(({ k, v }) => {
          const [a, b] = k.split("|");
          return `${a}/${b}: ${v}`;
        }).join("; ");
      detail = `Cramér's V=${metric.toFixed(3)}，${strength}。高频组合示例：${samples || "样本不足"}`;
    } else {
      detail = `关联度 ${metric.toFixed(3)}（${type === "mixed" ? "η" : "Cramér's V"}），${strength}`;
    }
    return [`${pair[0]} × ${pair[1]}`, strength, direction, detail];
  });
  return { title: "关联解读", columns: ["配对", "强度", "方向/类型", "解释"], rows };
}

function inferVarType(dataset: any[], varName: string, numericWhitelist: string[]): "numeric" | "categorical" {
  if (numericWhitelist.includes(varName)) return "numeric";
  for (const row of dataset) {
    const val = row?.[varName];
    if (val === null || val === undefined) continue;
    if (typeof val === "number") return "numeric";
    if (typeof val === "string") return "categorical";
  }
  return "categorical";
}

function cramersV(dataset: any[], a: string, b: string) {
  const table = new Map<string, number>();
  let n = 0;
  dataset.forEach((row) => {
    const va = row?.[a];
    const vb = row?.[b];
    if (va === null || va === undefined || vb === null || vb === undefined) return;
    const key = `${String(va)}|${String(vb)}`;
    table.set(key, (table.get(key) || 0) + 1);
    n += 1;
  });
  if (n === 0) return { v: 0, n: 0 };

  const aLevels = new Set<string>();
  const bLevels = new Set<string>();
  table.forEach((_count, key) => {
    const [va, vb] = key.split("|");
    aLevels.add(va); bLevels.add(vb);
  });

  // Build contingency matrix and expected counts
  const aArr = Array.from(aLevels);
  const bArr = Array.from(bLevels);
  const counts: number[][] = aArr.map(() => bArr.map(() => 0));
  table.forEach((count, key) => {
    const [va, vb] = key.split("|");
    const i = aArr.indexOf(va);
    const j = bArr.indexOf(vb);
    if (i >= 0 && j >= 0) counts[i][j] = count;
  });

  const rowTotals = counts.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals = bArr.map((_, j) => counts.reduce((s, row) => s + row[j], 0));

  let chi2 = 0;
  counts.forEach((row, i) => {
    row.forEach((obs, j) => {
      const exp = (rowTotals[i] * colTotals[j]) / n || 0;
      if (exp > 0) chi2 += ((obs - exp) ** 2) / exp;
    });
  });

  const k = Math.min(aArr.length, bArr.length);
  const v = Math.sqrt(chi2 / (n * (k - 1 || 1)));
  return { v: isFinite(v) ? v : 0, n };
}

function correlationRatio(dataset: any[], catVar: string, numVar: string) {
  const groups = new Map<string, number[]>();
  dataset.forEach((row) => {
    const cat = row?.[catVar];
    const rawVal = row?.[numVar];
    const val = Number(rawVal);
    if (cat === null || cat === undefined) return;
    if (!isFinite(val)) return;
    const key = String(cat);
    const arr = groups.get(key) || [];
    arr.push(val);
    groups.set(key, arr);
  });
  const allVals = Array.from(groups.values()).flat();
  const n = allVals.length;
  if (n === 0) return { eta: 0, n: 0 };
  const overallMean = allVals.reduce((s, v) => s + v, 0) / n;

  let ssBetween = 0;
  let ssTotal = 0;
  groups.forEach((vals) => {
    if (vals.length === 0) return;
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    ssBetween += vals.length * (mean - overallMean) ** 2;
    vals.forEach((v) => { ssTotal += (v - overallMean) ** 2; });
  });

  const eta2 = ssTotal > 0 ? ssBetween / ssTotal : 0;
  const eta = Math.sqrt(Math.max(0, Math.min(1, eta2)));
  return { eta, n };
}

function describeStrength(v: number) {
  const a = Math.abs(v);
  if (a >= 0.7) return "很强";
  if (a >= 0.5) return "强";
  if (a >= 0.3) return "中等";
  if (a >= 0.1) return "较弱";
  return "极弱";
}

function collectNumericPair(dataset: any[], a: string, b: string) {
  const xs: number[] = [];
  const ys: number[] = [];
  dataset.forEach((row) => {
    const x = Number(row?.[a]);
    const y = Number(row?.[b]);
    if (isFinite(x) && isFinite(y)) { xs.push(x); ys.push(y); }
  });
  return { xs, ys };
}

function fitLine(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return { m: 0, b: 0, minX: 0, maxX: 0 };
  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const m = den === 0 ? 0 : num / den;
  const b = my - m * mx;
  const minX = Math.min(...xs.slice(0, n));
  const maxX = Math.max(...xs.slice(0, n));
  return { m, b, minX, maxX };
}

function buildScatterFigures(dataset: any[], meta: { pair: [string, string]; metric: number; type: "numeric" | "categorical" | "mixed" }[]) {
  const numericPairs = meta.filter((m) => m.type === "numeric").sort((a, b) => Math.abs(b.metric) - Math.abs(a.metric)).slice(0, 3);
  const figs: any[] = [];
  numericPairs.forEach((item) => {
    const { xs, ys } = collectNumericPair(dataset, item.pair[0], item.pair[1]);
    const n = Math.min(xs.length, ys.length);
    if (n < 5) return;
    const points = xs.slice(0, n).map((x, i) => [x, ys[i]]);
    const line = fitLine(xs.slice(0, n), ys.slice(0, n));
    figs.push({
      title: `${item.pair[0]} vs ${item.pair[1]} (散点+趋势)`,
      type: "echarts" as const,
      option: {
        tooltip: { trigger: "axis" },
        xAxis: { type: "value", name: item.pair[0] },
        yAxis: { type: "value", name: item.pair[1] },
        dataZoom: [
          { type: "inside", xAxisIndex: 0, filterMode: "none" },
          { type: "inside", yAxisIndex: 0, filterMode: "none" },
          { type: "slider", xAxisIndex: 0, height: 14 },
          { type: "slider", yAxisIndex: 0, width: 14 }
        ],
        series: [
          {
            type: "scatter",
            symbolSize: 6,
            data: points,
            itemStyle: { color: "#2f81f7", opacity: 0.7 }
          },
          {
            type: "line",
            data: [
              [line.minX, line.m * line.minX + line.b],
              [line.maxX, line.m * line.maxX + line.b]
            ],
            smooth: false,
            showSymbol: false,
            lineStyle: { color: "#f85149", width: 2, type: "dashed" }
          }
        ],
        grid: { left: 50, right: 24, top: 18, bottom: 36 }
      }
    });
  });
  return figs;
}

function buildCategoricalFigures(dataset: any[], meta: { pair: [string, string]; metric: number; type: "numeric" | "categorical" | "mixed" }[], numVars: string[]) {
  const figs: any[] = [];

  // Mixed: 分类-数值 -> 类别均值条形图
  const mixedPairs = meta.filter((m) => m.type === "mixed").sort((a, b) => Math.abs(b.metric) - Math.abs(a.metric)).slice(0, 3);
  mixedPairs.forEach((item) => {
    const [a, b] = item.pair;
    const catVar = numVars.includes(a) ? b : a;
    const numVar = numVars.includes(a) ? a : b;
    const stats = categoryMean(dataset, catVar, numVar);
    if (stats.labels.length === 0) return;
    figs.push({
      title: `${catVar} → ${numVar} (均值/样本数)`,
      type: "echarts" as const,
      option: {
        tooltip: { trigger: "axis", formatter: (params: any) => {
          const p = Array.isArray(params) ? params[0] : params;
          const idx = p?.dataIndex ?? 0;
          const mean = typeof p?.data === "number" ? p.data.toFixed(3) : p?.data?.value ?? "";
          const count = stats.counts[idx] ?? 0;
          return `${p?.axisValue}: 均值 ${mean} (n=${count})`;
        } },
        xAxis: { type: "category", data: stats.labels, axisLabel: { rotate: 30, interval: 0 } },
        yAxis: { type: "value", name: numVar },
        dataZoom: [{ type: "slider", xAxisIndex: 0, height: 14 }],
        series: [{ type: "bar", data: stats.means, itemStyle: { color: "#2f81f7" }, label: { show: true, position: "top", formatter: (p: any) => stats.counts[p.dataIndex] ? `n=${stats.counts[p.dataIndex]}` : "" } }],
        grid: { left: 50, right: 20, top: 20, bottom: 60 }
      }
    });
  });

  // Categorical-Categorical -> 堆叠条形图（前 5 类）
  const catPairs = meta.filter((m) => m.type === "categorical").sort((a, b) => Math.abs(b.metric) - Math.abs(a.metric)).slice(0, 2);
  catPairs.forEach((item) => {
    const [a, b] = item.pair;
    const matrix = crossTab(dataset, a, b, 5, 5);
    if (matrix.rows.length === 0 || matrix.cols.length === 0) return;
    figs.push({
      title: `${a} × ${b} (频次分布)`,
      type: "echarts" as const,
      option: {
        tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
        legend: { data: matrix.cols },
        xAxis: { type: "category", data: matrix.rows, axisLabel: { rotate: 30, interval: 0 } },
        yAxis: { type: "value", name: "频次" },
        dataZoom: [{ type: "slider", xAxisIndex: 0, height: 14 }],
        series: matrix.cols.map((col) => ({
          name: col,
          type: "bar",
          stack: "total",
          data: matrix.rows.map((r) => matrix.counts.get(`${r}|${col}`) || 0)
        })),
        grid: { left: 50, right: 20, top: 40, bottom: 60 }
      }
    });
  });

  return figs;
}

function categoryMean(dataset: any[], catVar: string, numVar: string, topN = 12) {
  const groups = new Map<string, number[]>();
  dataset.forEach((row) => {
    const cat = row?.[catVar];
    const rawVal = row?.[numVar];
    const val = Number(rawVal);
    if (cat === null || cat === undefined || !isFinite(val)) return;
    const key = String(cat);
    const arr = groups.get(key) || [];
    arr.push(val);
    groups.set(key, arr);
  });
  const entries = Array.from(groups.entries()).map(([k, vals]) => ({ k, mean: vals.reduce((s, v) => s + v, 0) / vals.length, n: vals.length }));
  // Top categories by count
  const sorted = entries.sort((a, b) => b.n - a.n).slice(0, topN);
  return {
    labels: sorted.map((e) => e.k),
    means: sorted.map((e) => Number(e.mean.toFixed(3))),
    counts: sorted.map((e) => e.n)
  };
}

function crossTab(dataset: any[], rowVar: string, colVar: string, maxRows = 8, maxCols = 6) {
  const counts = new Map<string, number>();
  const rowLevels = new Map<string, number>();
  const colLevels = new Map<string, number>();
  dataset.forEach((row) => {
    const r = row?.[rowVar];
    const c = row?.[colVar];
    if (r === null || r === undefined || c === null || c === undefined) return;
    const rk = String(r);
    const ck = String(c);
    rowLevels.set(rk, (rowLevels.get(rk) || 0) + 1);
    colLevels.set(ck, (colLevels.get(ck) || 0) + 1);
    const key = `${rk}|${ck}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const topRows = Array.from(rowLevels.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxRows).map(([k]) => k);
  const topCols = Array.from(colLevels.entries()).sort((a, b) => b[1] - a[1]).slice(0, maxCols).map(([k]) => k);

  // Filter counts to top rows/cols only
  const filteredCounts = new Map<string, number>();
  counts.forEach((v, key) => {
    const [r, c] = key.split("|");
    if (topRows.includes(r) && topCols.includes(c)) {
      filteredCounts.set(key, v);
    }
  });

  return { rows: topRows, cols: topCols, counts: filteredCounts };
}

function buildSymmetricTable(vars: string[], pairRows: (string | number | null)[][]) {
  const header = ["变量", ...vars];
  const lookup = new Map<string, { r: number; p: number | null }>();
  pairRows.forEach((r) => {
    const [label, rVal, _s, _n, pVal] = r as [string, number, any, any, any];
    const [a, b] = String(label).split(" × ");
    const numeric = typeof rVal === "number" && !isNaN(rVal);
    if (!numeric) return; // only keep numeric-numeric pairs
    lookup.set(`${a}|${b}`, { r: rVal, p: typeof pVal === "number" ? pVal : null });
    lookup.set(`${b}|${a}`, { r: rVal, p: typeof pVal === "number" ? pVal : null });
    lookup.set(`${a}|${a}`, { r: 1, p: 0 });
    lookup.set(`${b}|${b}`, { r: 1, p: 0 });
  });
  const rows = vars.map((rowVar) => {
    const cells = vars.map((colVar) => {
      const entry = lookup.get(`${rowVar}|${colVar}`) || { r: rowVar === colVar ? 1 : 0, p: rowVar === colVar ? 0 : null };
      const star = entry.p === null ? "" : signifStars(entry.p);
      return `${Number(entry.r).toFixed(3)}${entry.p !== null ? `(${entry.p.toExponential(1)}${star})` : ""}`;
    });
    return [rowVar, ...cells];
  });
  return { title: "相关系数对称表（含显著性）", columns: header, rows };
}

function buildNarrative(vars: string[], pairCount: number, focusVar?: string) {
  const target = focusVar ? `聚焦变量 "${focusVar}"` : "全部变量配对";
  return [
    `分析流程：1) 数值-数值采用 Pearson & Spearman（给出 p 值）；2) 分类-分类用 Cramér's V，分类-数值用相关比 η；3) 数值变量用热力图展示整体结构${focusVar ? "，并输出焦点条形图" : ""}。`,
    `分析结论：${target}共 ${pairCount} 个配对。数值相关显著性以 (* p<0.10, ** p<0.05, *** p<0.01) 标记；|r|≈0.1/0.3/0.5 约对应弱/中/强，Cramér's V 与 η 亦可用同样阈值近似判断。`,
    "注意：相关/关联不代表因果；若样本量小或存在离群值，建议结合稳健/非参数相关或可视化复核。"
  ].join("\n");
}

function signifStars(p: number) {
  if (p < 0.001) return "***";
  if (p < 0.01) return "**";
  if (p < 0.05) return "*";
  return "";
}

/** Approximate two-tailed p-value from t-distribution (via regularized beta) */
function tDistCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const p = incBeta(x, df / 2, 0.5);
  return Math.min(1, Math.max(0, p));
}

/** Regularized incomplete beta function I_x(a,b) via continued fraction */
function incBeta(x: number, a: number, b: number): number {
  if (x < 0 || x > 1) return NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;
  const lbeta = lgamma(a) + lgamma(b) - lgamma(a + b);
  const front = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - lbeta) / a;
  // Use Lentz continued fraction
  const maxIter = 200;
  const eps = 1e-8;
  let cf = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  cf = d;
  for (let m = 1; m <= maxIter; m++) {
    const m2 = 2 * m;
    let num = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    let delta = 1 + num * d;
    if (Math.abs(delta) < 1e-30) delta = 1e-30;
    d = 1 / delta;
    cf *= delta * d;
    num = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    delta = 1 + num * d;
    if (Math.abs(delta) < 1e-30) delta = 1e-30;
    d = 1 / delta;
    const _cf = cf;
    cf *= delta * d;
    if (Math.abs(cf - _cf) < eps * Math.abs(cf)) break;
  }
  return front * cf;
}

function lgamma(x: number): number {
  const c = [
    0.99999999999980993,
    676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7
  ];
  const g = 7;
  if (x < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

export default { spec, run };
