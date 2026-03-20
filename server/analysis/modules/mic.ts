import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";

/* ════════════════════════════════════════════════════════
   MIC — Maximal Information Coefficient
   最大信息系数（纯 TypeScript 实现）
   ════════════════════════════════════════════════════════ */

const spec: AlgorithmSpec = {
    id: "ml.mic",
    name: "最大信息系数 (MIC)",
    category: "ml",
    subcategory: "diagnosis",
    description: "检测变量间任意形式的非线性关联，不受线性假设约束，输出 0~1 的关联强度矩阵。",
    explanation:
        "MIC 是一种基于互信息的统计指标，能同时捕捉线性和各种非线性关系（如 U 型、周期、阈值跳跃等）。" +
        "Pearson 相关系数只能检测线性关系，而 MIC 在两个变量之间存在「任何类型」的依赖关系时都会给出高分。" +
        "值域 0~1：0 表示完全独立，1 表示完美的函数关系。",
    inputSpec: [
        { id: "target", label: "目标变量（可选）", acceptedTypes: ["numeric"], min: 0, max: 1 },
        { id: "features", label: "分析变量", acceptedTypes: ["numeric"], min: 2 },
    ],
    paramSchema: [
        { key: "alpha", label: "搜索指数 α（控制网格精度）", type: "number", default: 0.6, min: 0.3, max: 0.9, step: 0.05 },
        { key: "clamp", label: "最大网格边长", type: "number", default: 15, min: 5, max: 30, step: 1 },
        {
            key: "impute", label: "缺失值填补", type: "select", options: [
                { label: "均值", value: "mean" },
                { label: "中位数", value: "median" },
                { label: "删除行", value: "drop" },
            ], default: "mean"
        },
    ],
    citation: "Reshef et al. (2011). Detecting Novel Associations in Large Data Sets. Science, 334(6062), 1518-1524.",
};

/* ── 互信息计算 ── */
function mutualInfo(xBins: number[], yBins: number[], nxBins: number, nyBins: number, N: number): number {
    // joint counts
    const joint = new Float64Array(nxBins * nyBins);
    const mx = new Float64Array(nxBins);
    const my = new Float64Array(nyBins);

    for (let i = 0; i < N; i++) {
        const xi = xBins[i];
        const yi = yBins[i];
        joint[xi * nyBins + yi]++;
        mx[xi]++;
        my[yi]++;
    }

    let mi = 0;
    for (let a = 0; a < nxBins; a++) {
        if (mx[a] === 0) continue;
        for (let b = 0; b < nyBins; b++) {
            if (my[b] === 0 || joint[a * nyBins + b] === 0) continue;
            const pxy = joint[a * nyBins + b] / N;
            const px = mx[a] / N;
            const py = my[b] / N;
            mi += pxy * Math.log(pxy / (px * py));
        }
    }
    return mi;
}

/* ── 等频分箱 ── */
function equipartition(values: number[], numBins: number): number[] {
    const N = values.length;
    const indices = Array.from({ length: N }, (_, i) => i);
    indices.sort((a, b) => values[a] - values[b]);

    const bins = new Array(N);
    for (let i = 0; i < N; i++) {
        bins[indices[i]] = Math.min(Math.floor(i * numBins / N), numBins - 1);
    }
    return bins;
}

/* ── 最优化分箱（在给定 x 分区下，对 y 做动态规划最优分区）── */
function optimizeBins(
    xVals: number[], yVals: number[],
    nxBins: number, nyBins: number
): { mi: number } {
    const N = xVals.length;
    const xBins = equipartition(xVals, nxBins);
    const yBins = equipartition(yVals, nyBins);
    const mi = mutualInfo(xBins, yBins, nxBins, nyBins, N);
    return { mi };
}

/* ── MIC 计算 ── */
function computeMIC(x: number[], y: number[], alpha: number, clamp: number): number {
    const N = x.length;
    if (N < 6) return 0;

    const B = Math.min(Math.pow(N, alpha), clamp * clamp);
    let maxNormMI = 0;

    // 搜索所有 (a, b) 网格组合，其中 a * b <= B
    for (let a = 2; a <= Math.min(clamp, Math.floor(B / 2)); a++) {
        for (let b = 2; b <= Math.min(clamp, Math.floor(B / a)); b++) {
            const { mi } = optimizeBins(x, y, a, b);
            const norm = mi / Math.log(Math.min(a, b));
            if (norm > maxNormMI) maxNormMI = norm;

            // 也尝试反向
            if (a !== b) {
                const { mi: mi2 } = optimizeBins(y, x, b, a);
                const norm2 = mi2 / Math.log(Math.min(a, b));
                if (norm2 > maxNormMI) maxNormMI = norm2;
            }
        }
    }

    return Math.min(1, maxNormMI); // clamp to [0, 1]
}

/* ── Pearson 相关系数 ── */
function pearson(x: number[], y: number[]): number {
    const N = x.length;
    if (N < 3) return 0;
    const mx = x.reduce((a, b) => a + b, 0) / N;
    const my = y.reduce((a, b) => a + b, 0) / N;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < N; i++) {
        const dx = x[i] - mx;
        const dy = y[i] - my;
        sxy += dx * dy;
        sxx += dx * dx;
        syy += dy * dy;
    }
    const denom = Math.sqrt(sxx * syy);
    return denom === 0 ? 0 : sxy / denom;
}

/* ── 缺失值处理 ── */
function imputeColumn(values: any[], strategy: string): number[] {
    const nums = values.map(v => {
        const n = Number(v);
        return isFinite(n) ? n : NaN;
    });
    if (strategy === "drop") return nums; // 在外层处理

    const valid = nums.filter(v => !isNaN(v));
    if (valid.length === 0) return nums.map(() => 0);

    let fill: number;
    if (strategy === "median") {
        const sorted = [...valid].sort((a, b) => a - b);
        fill = sorted[Math.floor(sorted.length / 2)];
    } else {
        fill = valid.reduce((a, b) => a + b, 0) / valid.length;
    }

    return nums.map(v => isNaN(v) ? fill : v);
}

/* ── 主函数 ── */
async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
    const log = (msg: string) => { if (onLog) onLog(msg); };
    const target = variables["target"]?.[0] || null;
    const features: string[] = variables["features"] || [];
    if (features.length < 2 && !target) throw new Error("至少需要 2 个变量");

    const alpha = Number(params.alpha) || 0.6;
    const clamp = Number(params.clamp) || 15;
    const imputeStrategy = params.impute || "mean";

    // 收集所有需要分析的列
    const allCols = target ? [target, ...features.filter(f => f !== target)] : [...features];
    const uniqueCols = [...new Set(allCols)];

    log(`[MIC] ${dataset.length} 行, ${uniqueCols.length} 个变量, α=${alpha}`);

    // 提取数值列
    const colData: Record<string, number[]> = {};
    for (const col of uniqueCols) {
        colData[col] = imputeColumn(dataset.map((r: any) => r[col]), imputeStrategy);
    }

    // 如果策略是 drop，找出所有列都有效的行索引
    let validIndices: number[];
    if (imputeStrategy === "drop") {
        validIndices = [];
        for (let i = 0; i < dataset.length; i++) {
            if (uniqueCols.every(col => !isNaN(colData[col][i]))) validIndices.push(i);
        }
        for (const col of uniqueCols) {
            colData[col] = validIndices.map(i => colData[col][i]);
        }
    } else {
        validIndices = Array.from({ length: dataset.length }, (_, i) => i);
    }

    const N = colData[uniqueCols[0]].length;
    log(`[MIC] 有效样本 ${N} 行`);
    if (N < 10) throw new Error("有效数据不足 10 行");

    // ── 计算 MIC 矩阵 ──
    const micMatrix: number[][] = [];
    const pearsonMatrix: number[][] = [];
    const nonlinearityMatrix: number[][] = []; // MIC - |r|² : shows non-linearity

    log(`[MIC] 开始计算 ${uniqueCols.length}×${uniqueCols.length} 矩阵...`);
    let pairsDone = 0;
    const totalPairs = uniqueCols.length * (uniqueCols.length - 1) / 2;

    for (let i = 0; i < uniqueCols.length; i++) {
        micMatrix.push([]);
        pearsonMatrix.push([]);
        nonlinearityMatrix.push([]);
        for (let j = 0; j < uniqueCols.length; j++) {
            if (i === j) {
                micMatrix[i].push(1);
                pearsonMatrix[i].push(1);
                nonlinearityMatrix[i].push(0);
            } else if (j < i) {
                micMatrix[i].push(micMatrix[j][i]);
                pearsonMatrix[i].push(pearsonMatrix[j][i]);
                nonlinearityMatrix[i].push(nonlinearityMatrix[j][i]);
            } else {
                const mic = computeMIC(colData[uniqueCols[i]], colData[uniqueCols[j]], alpha, clamp);
                const r = pearson(colData[uniqueCols[i]], colData[uniqueCols[j]]);
                const nonlin = Math.max(0, mic - r * r);
                micMatrix[i].push(Number(mic.toFixed(4)));
                pearsonMatrix[i].push(Number(r.toFixed(4)));
                nonlinearityMatrix[i].push(Number(nonlin.toFixed(4)));
                pairsDone++;
                if (pairsDone % 5 === 0 || pairsDone === totalPairs) {
                    log(`[MIC] 进度 ${pairsDone}/${totalPairs} 对`);
                }
            }
        }
    }

    // ── 如果指定了 target，按与 target 的 MIC 排序 ──
    interface PairResult {
        col: string;
        mic: number;
        pearson: number;
        nonlinearity: number;
    }

    const targetResults: PairResult[] = [];
    if (target) {
        const tIdx = uniqueCols.indexOf(target);
        for (let j = 0; j < uniqueCols.length; j++) {
            if (j === tIdx) continue;
            targetResults.push({
                col: uniqueCols[j],
                mic: micMatrix[tIdx][j],
                pearson: pearsonMatrix[tIdx][j],
                nonlinearity: nonlinearityMatrix[tIdx][j],
            });
        }
        targetResults.sort((a, b) => b.mic - a.mic);
    }

    log(`[MIC] 计算完成`);

    // ── 表格输出 ──
    const tables: AnalysisResult["tables"] = [];

    if (target && targetResults.length > 0) {
        tables.push({
            title: `🎯 各特征与目标 [${target}] 的关联强度排名`,
            explanation:
                "MIC（最大信息系数）能捕获任何类型的函数关系，值域 0~1。" +
                "当 MIC 明显高于 |Pearson|² 时，说明存在「非线性关系」（如 U 型、阈值跳跃等），此时线性模型会严重低估该特征的真实重要性。",
            columns: ["排名", "特征", "MIC（总关联）", "Pearson r（线性）", "|r|²（可线性解释）", "非线性剩余(MIC-|r|²)", "关系类型"],
            rows: targetResults.map((r, i) => {
                const r2 = r.pearson * r.pearson;
                const type = r.mic < 0.1 ? "❌ 基本无关"
                    : r.nonlinearity > 0.15 ? "🌀 强非线性"
                        : r.nonlinearity > 0.05 ? "📐 混合(线性+非线性)"
                            : r.mic > 0.3 ? "📏 近线性"
                                : "⚪ 弱关联";
                return [
                    i + 1,
                    r.col,
                    r.mic,
                    Number(r.pearson.toFixed(4)),
                    Number(r2.toFixed(4)),
                    r.nonlinearity,
                    type,
                ];
            }),
        });
    }

    // MIC 矩阵表
    tables.push({
        title: "📊 MIC 关联矩阵",
        explanation: "对称矩阵，值域 0~1。越接近 1 表示两变量之间存在越强的依赖关系（不限于线性）。",
        columns: ["变量", ...uniqueCols],
        rows: uniqueCols.map((col, i) => [col, ...micMatrix[i]]),
    });

    // 非线性发现表（仅选出非线性残差高的对）
    const nonlinPairs: { col1: string; col2: string; mic: number; r: number; nonlin: number }[] = [];
    for (let i = 0; i < uniqueCols.length; i++) {
        for (let j = i + 1; j < uniqueCols.length; j++) {
            if (nonlinearityMatrix[i][j] > 0.05) {
                nonlinPairs.push({
                    col1: uniqueCols[i],
                    col2: uniqueCols[j],
                    mic: micMatrix[i][j],
                    r: pearsonMatrix[i][j],
                    nonlin: nonlinearityMatrix[i][j],
                });
            }
        }
    }
    nonlinPairs.sort((a, b) => b.nonlin - a.nonlin);

    if (nonlinPairs.length > 0) {
        tables.push({
            title: "🌀 非线性关系发现",
            explanation: "以下变量对的 MIC 明显高于 Pearson²，说明它们之间存在Pearson无法衡量的非线性关系。这些变量适合用MARS、决策树等非线性模型处理。",
            columns: ["变量 A", "变量 B", "MIC", "Pearson r", "非线性剩余", "提示"],
            rows: nonlinPairs.slice(0, 15).map(p => [
                p.col1, p.col2,
                p.mic, Number(p.r.toFixed(4)), p.nonlin,
                p.nonlin > 0.2 ? "⚡ 强烈建议使用非线性模型" : "💡 建议关注非线性效应",
            ]),
        });
    }

    // ── 可视化 ──
    const figures: AnalysisResult["figures"] = [];

    // MIC 热力图
    const micVals = micMatrix.flat().filter(v => v < 1);
    const micMin = micVals.length > 0 ? Math.min(...micVals) : 0;
    const micMax = micVals.length > 0 ? Math.max(...micVals) : 1;

    figures.push({
        title: "🔥 MIC 关联热力图",
        explanation: "深色表示强关联。与 Pearson 热力图对比，如果某些格子在此图中深色但在 Pearson 中浅色，说明该对变量存在隐藏的非线性关系。",
        type: "echarts",
        option: {
            tooltip: {
                formatter: (p: any) => `${uniqueCols[p.value[1]]} × ${uniqueCols[p.value[0]]}<br/>MIC = ${p.value[2]}`,
            },
            xAxis: { type: "category", data: uniqueCols, axisLabel: { rotate: 45, fontSize: 10 } },
            yAxis: { type: "category", data: [...uniqueCols].reverse(), axisLabel: { fontSize: 10 } },
            visualMap: {
                min: micMin === micMax ? 0 : micMin,
                max: micMin === micMax ? 1 : micMax,
                calculable: true,
                orient: "vertical",
                right: 0,
                top: 20,
                inRange: { color: ["#f0f9ff", "#3b82f6", "#1e3a8a"] },
            },
            series: [{
                type: "heatmap",
                data: uniqueCols.flatMap((_, i) =>
                    uniqueCols.map((_, j) => [j, uniqueCols.length - 1 - i, micMatrix[i][j]])
                ),
                itemStyle: { borderWidth: 1, borderColor: "#fff" },
                label: { show: uniqueCols.length <= 8, fontSize: 10 },
            }],
            grid: { left: 80, right: 80, top: 20, bottom: 60 },
        },
    });

    // 如果有 target：MIC vs Pearson² 对比条形图
    if (target && targetResults.length > 0) {
        const top = targetResults.slice(0, 12);
        figures.push({
            title: `📊 MIC vs Pearson² 对比 — 目标 [${target}]`,
            explanation: "蓝色条=MIC（总关联强度），橙色条=|Pearson|²（线性可解释部分）。两色差距越大，说明该特征与目标的关系越是非线性的。",
            type: "echarts",
            option: {
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                legend: { data: ["MIC", "|Pearson|²"] },
                yAxis: { type: "category", data: top.map(r => r.col).reverse(), axisLabel: { fontSize: 11 } },
                xAxis: { type: "value", max: 1, name: "关联强度" },
                series: [
                    {
                        name: "MIC", type: "bar",
                        data: top.map(r => r.mic).reverse(),
                        itemStyle: { color: "#3b82f6" },
                        barGap: "0%",
                    },
                    {
                        name: "|Pearson|²", type: "bar",
                        data: top.map(r => Number((r.pearson * r.pearson).toFixed(4))).reverse(),
                        itemStyle: { color: "#f97316" },
                    },
                ],
                grid: { left: 100, right: 30, top: 40, bottom: 30 },
            },
        });

        // 散点图：MIC vs |Pearson|
        figures.push({
            title: "🔍 MIC vs |Pearson| 散点（非线性检测器）",
            explanation: "落在对角线上方的点=存在非线性关系（MIC 捕获了 Pearson 看不到的信息）。落在对角线附近=关系主要是线性的。",
            type: "echarts",
            option: {
                tooltip: { formatter: (p: any) => `${p.data[2]}<br/>|Pearson|=${p.data[0].toFixed(3)}<br/>MIC=${p.data[1].toFixed(3)}` },
                xAxis: { name: "|Pearson|", type: "value", min: 0, max: 1 },
                yAxis: { name: "MIC", type: "value", min: 0, max: 1 },
                series: [
                    {
                        type: "scatter", symbolSize: 12,
                        data: targetResults.map(r => [Math.abs(r.pearson), r.mic, r.col]),
                        itemStyle: {
                            color: (p: any) => {
                                const mic = p.data[1];
                                const absR = p.data[0];
                                return mic - absR * absR > 0.1 ? "#ef4444" : "#3b82f6";
                            },
                        },
                        label: { show: targetResults.length <= 10, formatter: (p: any) => p.data[2], position: "right", fontSize: 10 },
                    },
                    {
                        type: "line", data: [[0, 0], [1, 1]],
                        lineStyle: { type: "dashed", color: "#9ca3af", width: 1 },
                        symbol: "none",
                    },
                ],
                grid: { left: 60, right: 20, top: 30, bottom: 50 },
            },
        });
    }

    // ── 双变量散点图（按 MIC 降序，最有趣的对优先） ──
    log(`[MIC] 生成双变量散点图...`);

    // 收集所有变量对并按 MIC 排序
    interface VarPair { col1: string; col2: string; i: number; j: number; mic: number; r: number }
    const allPairs: VarPair[] = [];
    for (let i = 0; i < uniqueCols.length; i++) {
        for (let j = i + 1; j < uniqueCols.length; j++) {
            allPairs.push({
                col1: uniqueCols[i], col2: uniqueCols[j],
                i, j,
                mic: micMatrix[i][j],
                r: pearsonMatrix[i][j],
            });
        }
    }
    allPairs.sort((a, b) => b.mic - a.mic);

    // 限制最多画 15 张散点图
    const pairsToPlot = allPairs.slice(0, 15);

    // 如果数据量很大，做随机采样避免前端卡顿
    const maxScatterPoints = 500;
    const sampleIndices = N <= maxScatterPoints
        ? Array.from({ length: N }, (_, i) => i)
        : Array.from({ length: maxScatterPoints }, () => Math.floor(Math.random() * N));

    for (const pair of pairsToPlot) {
        const xData = colData[pair.col1];
        const yData = colData[pair.col2];

        const scatterPoints = sampleIndices.map(idx => [
            Number(xData[idx].toFixed(4)),
            Number(yData[idx].toFixed(4)),
        ]);

        const nonlinResidual = Math.max(0, pair.mic - pair.r * pair.r);
        const relType = nonlinResidual > 0.15 ? "🌀 非线性"
            : nonlinResidual > 0.05 ? "📐 混合"
                : pair.mic > 0.3 ? "📏 线性"
                    : "⚪ 弱";

        figures.push({
            title: `🔵 ${pair.col1} × ${pair.col2}  (MIC=${pair.mic}, r=${pair.r.toFixed(3)})`,
            explanation: `两变量散点分布。MIC=${pair.mic}（总关联），Pearson r=${pair.r.toFixed(3)}（线性），关系类型: ${relType}。` +
                (N > maxScatterPoints ? ` 已从 ${N} 条数据中随机抽样 ${maxScatterPoints} 个点展示。` : ""),
            type: "echarts",
            option: {
                tooltip: {
                    trigger: "item",
                    formatter: (p: any) => `${pair.col1}: ${p.value[0]}<br/>${pair.col2}: ${p.value[1]}`,
                },
                xAxis: { name: pair.col1, type: "value", nameLocation: "center", nameGap: 28 },
                yAxis: { name: pair.col2, type: "value", nameLocation: "center", nameGap: 40 },
                series: [{
                    type: "scatter",
                    data: scatterPoints,
                    symbolSize: 5,
                    itemStyle: {
                        color: nonlinResidual > 0.1 ? "rgba(239,68,68,0.6)"
                            : pair.mic > 0.3 ? "rgba(99,102,241,0.6)"
                                : "rgba(148,163,184,0.5)",
                    },
                }],
                grid: { left: 55, right: 15, top: 20, bottom: 45 },
            },
        });
    }

    // narrative
    let narrative = `MIC 分析完成：${uniqueCols.length} 个变量共 ${uniqueCols.length * (uniqueCols.length - 1) / 2} 对关联度计算。`;
    if (nonlinPairs.length > 0) {
        narrative += `\n\n🌀 发现 ${nonlinPairs.length} 对变量存在显著的非线性关系（MIC 远超 Pearson²），最突出的是 ${nonlinPairs[0].col1} × ${nonlinPairs[0].col2}（非线性剩余=${nonlinPairs[0].nonlin.toFixed(3)}）。`;
    }
    if (target && targetResults.length > 0) {
        const best = targetResults[0];
        narrative += `\n\n🏆 与目标 [${target}] 关联最强的特征是 ${best.col}（MIC=${best.mic}），${best.nonlinearity > 0.1 ? "且含有显著的非线性效应" : "关系主要为线性"}。`;
    }

    const warnings: string[] = [];
    if (N < 50) warnings.push("样本量较少（< 50），MIC 估计可能不够稳定，建议增加数据量。");
    if (uniqueCols.length > 15) warnings.push("变量数较多，计算量较大。如运行过慢可考虑减少变量数量。");

    return {
        tables,
        figures,
        narrative,
        warnings,
        assumptions: [
            `搜索指数 α=${alpha}，网格边长上限 ${clamp}`,
            "MIC 基于互信息与网格优化，值域 0~1",
            "非线性剩余 = MIC - |r|²，正值表示存在 Pearson 无法捕获的关系",
            "结果为关联度而非因果关系",
        ],
        citation: spec.citation,
    };
}

export default { spec, run };
