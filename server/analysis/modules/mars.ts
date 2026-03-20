import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { splitAndScale, processMLFeatures } from "../utils";

/* ════════════════════════════════════════════════════════
   MARS — Multivariate Adaptive Regression Splines
   多元自适应回归样条（纯 TypeScript 实现，零外部依赖）
   ════════════════════════════════════════════════════════ */

const spec: AlgorithmSpec = {
    id: "ml.mars",
    name: "多元自适应回归样条 (MARS)",
    category: "ml",
    subcategory: "regression",
    description: "自动发现非线性拐点与交互效应，输出分段线性模型与可解释的基函数规则。",
    explanation:
        "MARS 是一种非参数回归方法：它自动搜索每个特征上的最佳拐点（Knot），用分段铰链函数拼出任意形状的曲线。" +
        "相比线性回归能捕获非线性关系，相比树模型更平滑、更可解释。最终模型可写成一组可读的 IF-THEN 规则。",
    inputSpec: [
        { id: "target", label: "目标", acceptedTypes: ["numeric"], min: 1, max: 1 },
        { id: "features", label: "特征", acceptedTypes: ["numeric", "categorical"], min: 1 },
    ],
    paramSchema: [
        { key: "maxTerms", label: "最大基函数数", type: "number", default: 21, min: 3, max: 50, step: 1 },
        { key: "maxInteraction", label: "最大交互阶数", type: "number", default: 1, min: 1, max: 3, step: 1 },
        { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
        { key: "penalty", label: "GCV 惩罚因子 d", type: "number", default: 3, min: 1, max: 5, step: 0.5 },
        { key: "scale", label: "特征缩放", type: "select", options: [{ label: "标准化 (Z-score)", value: "standard" }, { label: "归一化 (Min-Max)", value: "minmax" }, { label: "不缩放", value: "none" }], default: "none" },
        { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值填补", value: "mean" }, { label: "中位数填补", value: "median" }, { label: "零填补", value: "zero" }], default: "mean" },
        { key: "oneHot", label: "自动独热编码", type: "boolean", default: true },
    ],
    citation: "Friedman, J. (1991). Multivariate Adaptive Regression Splines. Annals of Statistics, 19(1), 1-67.",
};

/* ── 基函数定义 ── */
interface HingeComponent {
    featureIdx: number;
    knot: number;
    sign: 1 | -1; // +1 = max(0, x-t), -1 = max(0, t-x)
}

interface BasisFunction {
    components: HingeComponent[]; // 交互 = 多个 component 相乘
    coeff: number;
}

function evalHinge(h: HingeComponent, x: number[]): number {
    const v = h.sign === 1 ? x[h.featureIdx] - h.knot : h.knot - x[h.featureIdx];
    return Math.max(0, v);
}

function evalBasis(bf: BasisFunction, x: number[]): number {
    let val = 1;
    for (const c of bf.components) {
        val *= evalHinge(c, x);
        if (val === 0) return 0;
    }
    return val;
}

/* ── OLS：用 Normal Equation 解 ── */
function olsFit(B: number[][], y: number[]): { coeffs: number[]; intercept: number } {
    const N = y.length;
    const M = B[0]?.length ?? 0;
    // B is [N x M], augment with intercept column
    const yMean = y.reduce((a, b) => a + b, 0) / N;

    // 直接使用 Gram matrix: (Bt B) beta = Bt y
    const BtB: number[][] = Array.from({ length: M + 1 }, () => new Array(M + 1).fill(0));
    const BtY: number[] = new Array(M + 1).fill(0);

    for (let i = 0; i < N; i++) {
        for (let j = 0; j < M; j++) {
            for (let k = j; k < M; k++) {
                BtB[j][k] += B[i][j] * B[i][k];
            }
            BtB[j][M] += B[i][j]; // intercept col
            BtY[j] += B[i][j] * y[i];
        }
        BtB[M][M] += 1;
        BtY[M] += y[i];
    }
    // 对称填充
    for (let j = 0; j < M + 1; j++) {
        for (let k = 0; k < j; k++) {
            BtB[j][k] = BtB[k][j];
        }
    }

    // 加微小岭避免奇异
    for (let j = 0; j <= M; j++) BtB[j][j] += 1e-8;

    // Gauss 消元
    const dim = M + 1;
    const A = BtB.map((row, i) => [...row, BtY[i]]);
    for (let col = 0; col < dim; col++) {
        let maxRow = col;
        for (let row = col + 1; row < dim; row++) {
            if (Math.abs(A[row][col]) > Math.abs(A[maxRow][col])) maxRow = row;
        }
        [A[col], A[maxRow]] = [A[maxRow], A[col]];
        const pivot = A[col][col];
        if (Math.abs(pivot) < 1e-12) continue;
        for (let j = col; j <= dim; j++) A[col][j] /= pivot;
        for (let row = 0; row < dim; row++) {
            if (row === col) continue;
            const factor = A[row][col];
            for (let j = col; j <= dim; j++) A[row][j] -= factor * A[col][j];
        }
    }
    const beta = A.map(row => row[dim]);
    return { coeffs: beta.slice(0, M), intercept: beta[M] || yMean };
}

/* ── GCV 计算 ── */
function gcv(rss: number, N: number, M: number, d: number): number {
    const cm = M + d * (M - 1) / 2; // effective number of params
    const denom = (1 - cm / N);
    if (denom <= 0) return Infinity;
    return (rss / N) / (denom * denom);
}

/* ── MARS Forward Pass ── */
function marsForward(
    X: number[][], y: number[], featureCount: number,
    maxTerms: number, maxInteraction: number, log: (s: string) => void
): BasisFunction[] {
    const N = X.length;
    const basis: BasisFunction[] = []; // 不含常数项

    // 为每个特征收集候选 knot（排重后取均匀子集，避免过多）
    const knots: number[][] = [];
    for (let f = 0; f < featureCount; f++) {
        const vals = [...new Set(X.map(r => r[f]))].sort((a, b) => a - b);
        // 取最多 20 个等距候选
        const step = Math.max(1, Math.floor(vals.length / 20));
        const sel: number[] = [];
        for (let i = 1; i < vals.length - 1; i += step) sel.push(vals[i]);
        knots.push(sel);
    }

    // 构建 B 矩阵
    const buildBMatrix = (): number[][] => {
        return X.map(x => basis.map(bf => evalBasis(bf, x)));
    };

    const computeRSS = (): number => {
        const B = buildBMatrix();
        if (basis.length === 0) {
            const mean = y.reduce((a, b) => a + b, 0) / N;
            return y.reduce((s, yi) => s + (yi - mean) ** 2, 0);
        }
        const { coeffs, intercept } = olsFit(B, y);
        let rss = 0;
        for (let i = 0; i < N; i++) {
            let pred = intercept;
            for (let j = 0; j < basis.length; j++) pred += coeffs[j] * B[i][j];
            rss += (y[i] - pred) ** 2;
        }
        return rss;
    };

    let currentRSS = computeRSS();
    log(`[MARS Forward] 初始 RSS=${currentRSS.toFixed(2)}`);

    while (basis.length < maxTerms - 1) { // -1 because intercept counts
        let bestRSS = currentRSS;
        let bestPair: [BasisFunction, BasisFunction] | null = null;

        // 在每个"父基函数"（或常数1）上尝试添加一对铰链
        const parents: (BasisFunction | null)[] = [null, ...basis];

        for (const parent of parents) {
            const parentOrder = parent ? parent.components.length : 0;
            if (parentOrder >= maxInteraction) continue;

            // 已在 parent 中使用的特征不重复
            const usedFeatures = new Set(parent ? parent.components.map(c => c.featureIdx) : []);

            for (let f = 0; f < featureCount; f++) {
                if (usedFeatures.has(f)) continue;

                for (const knot of knots[f]) {
                    // 候选 pair: (parent * h+(x,t)) 和 (parent * h-(x,t))
                    const compPlus: HingeComponent = { featureIdx: f, knot, sign: 1 };
                    const compMinus: HingeComponent = { featureIdx: f, knot, sign: -1 };

                    const bfPlus: BasisFunction = {
                        components: [...(parent?.components || []), compPlus],
                        coeff: 0,
                    };
                    const bfMinus: BasisFunction = {
                        components: [...(parent?.components || []), compMinus],
                        coeff: 0,
                    };

                    // 快速检查：至少有一些非零值
                    let nzPlus = 0, nzMinus = 0;
                    for (let i = 0; i < Math.min(N, 50); i++) {
                        if (evalBasis(bfPlus, X[i]) !== 0) nzPlus++;
                        if (evalBasis(bfMinus, X[i]) !== 0) nzMinus++;
                    }
                    if (nzPlus < 3 && nzMinus < 3) continue;

                    // 尝试同时加入 pair
                    basis.push(bfPlus, bfMinus);
                    const trialRSS = computeRSS();
                    basis.pop();
                    basis.pop();

                    if (trialRSS < bestRSS - 1e-6) {
                        bestRSS = trialRSS;
                        bestPair = [bfPlus, bfMinus];
                    }
                }
            }
        }

        if (!bestPair) break;

        basis.push(bestPair[0], bestPair[1]);
        currentRSS = bestRSS;
        log(`[MARS Forward] 添加第 ${basis.length - 1}~${basis.length} 项，RSS=${currentRSS.toFixed(2)}`);
    }

    return basis;
}

/* ── MARS Backward Pass (GCV 剪枝) ── */
function marsBackward(
    basis: BasisFunction[], X: number[][], y: number[],
    d: number, log: (s: string) => void
): BasisFunction[] {
    const N = X.length;

    const fitAndGCV = (bfs: BasisFunction[]): { gcvVal: number; rss: number } => {
        if (bfs.length === 0) {
            const mean = y.reduce((a, b) => a + b, 0) / N;
            const rss = y.reduce((s, yi) => s + (yi - mean) ** 2, 0);
            return { gcvVal: gcv(rss, N, 1, d), rss };
        }
        const B = X.map(x => bfs.map(bf => evalBasis(bf, x)));
        const { coeffs, intercept } = olsFit(B, y);
        let rss = 0;
        for (let i = 0; i < N; i++) {
            let pred = intercept;
            for (let j = 0; j < bfs.length; j++) pred += coeffs[j] * B[i][j];
            rss += (y[i] - pred) ** 2;
        }
        return { gcvVal: gcv(rss, N, bfs.length + 1, d), rss };
    };

    let current = [...basis];
    let bestGCV = fitAndGCV(current).gcvVal;

    log(`[MARS Backward] 初始 ${current.length} 项，GCV=${bestGCV.toFixed(4)}`);

    let improved = true;
    while (improved && current.length > 0) {
        improved = false;
        let bestIdx = -1;
        let bestNewGCV = bestGCV;

        for (let i = 0; i < current.length; i++) {
            const trial = [...current.slice(0, i), ...current.slice(i + 1)];
            const { gcvVal: g } = fitAndGCV(trial);
            if (g < bestNewGCV) {
                bestNewGCV = g;
                bestIdx = i;
            }
        }

        if (bestIdx >= 0) {
            current.splice(bestIdx, 1);
            bestGCV = bestNewGCV;
            improved = true;
            log(`[MARS Backward] 剪枝第 ${bestIdx + 1} 项，剩余 ${current.length} 项，GCV=${bestGCV.toFixed(4)}`);
        }
    }

    return current;
}

/* ── 回归指标 ── */
function regressionMetrics(y: number[], pred: number[]) {
    const n = y.length;
    const mse = y.reduce((acc, val, i) => acc + (val - pred[i]) ** 2, 0) / Math.max(n, 1);
    const rmse = Number(Math.sqrt(mse).toFixed(3));
    const mae = Number((y.reduce((acc, val, i) => acc + Math.abs(val - pred[i]), 0) / Math.max(n, 1)).toFixed(3));
    const meanY = y.reduce((a, b) => a + b, 0) / Math.max(n, 1);
    const ssTot = y.reduce((acc, val) => acc + (val - meanY) ** 2, 0);
    const ssRes = y.reduce((acc, val, i) => acc + (val - pred[i]) ** 2, 0);
    const r2 = Number((1 - ssRes / Math.max(ssTot, 1e-10)).toFixed(3));
    return { rmse, mae, r2 };
}

/* ── 主函数 ── */
async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
    const log = (msg: string) => { if (onLog) onLog(msg); };
    const target = variables["target"]?.[0];
    const feats = variables["features"] || [];
    if (!target || feats.length === 0) throw new Error("请指定目标变量和至少一个特征");

    log(`[MARS] 开始预处理，共 ${dataset.length} 样本...`);

    const impute = params.impute || "mean";
    const { extractX, finalFeatureNames, pipeline } = processMLFeatures(dataset, feats, impute, Boolean(params.oneHot ?? true));
    const featNames = finalFeatureNames;

    const rows = dataset
        .map((row: any) => {
            const yVal = Number(row[target]);
            if (isNaN(yVal)) return null;
            return { x: extractX(row), y: yVal };
        })
        .filter(Boolean) as { x: number[]; y: number }[];

    if (rows.length < 10) throw new Error("有效样本不足 10 条");
    log(`[MARS] 有效样本: ${rows.length}，特征: ${featNames.length}`);

    const testSize = Number(params.testSize) || 0.3;
    const { trainX, trainY, testX, testY, scaler } = splitAndScale(rows, testSize, (params.scale as any) || "none");
    log(`[MARS] 训练集 ${trainX.length}，测试集 ${testX.length}`);

    const maxTerms = Math.min(Number(params.maxTerms) || 21, Math.floor(trainX.length / 3));
    const maxInteraction = Number(params.maxInteraction) || 1;
    const penalty = Number(params.penalty) || 3;

    // ── Forward ──
    log(`[MARS] 前向搜索（最多 ${maxTerms} 项，交互≤${maxInteraction} 阶）...`);
    const forwardBasis = marsForward(trainX, trainY, featNames.length, maxTerms, maxInteraction, log);
    log(`[MARS] 前向阶段完成，共 ${forwardBasis.length} 项基函数`);

    // ── Backward ──
    log(`[MARS] 后向剪枝（GCV 惩罚 d=${penalty}）...`);
    const finalBasis = marsBackward(forwardBasis, trainX, trainY, penalty, log);
    log(`[MARS] 剪枝完成，保留 ${finalBasis.length} 项基函数`);

    // ── 最终拟合 ──
    const buildB = (X: number[][]) => X.map(x => finalBasis.map(bf => evalBasis(bf, x)));
    const Btrain = buildB(trainX);

    let intercept = 0;
    let coeffs: number[] = [];

    if (finalBasis.length > 0) {
        const fit = olsFit(Btrain, trainY);
        intercept = fit.intercept;
        coeffs = fit.coeffs;
        finalBasis.forEach((bf, i) => { bf.coeff = coeffs[i]; });
    } else {
        intercept = trainY.reduce((a, b) => a + b, 0) / trainY.length;
    }

    const predict = (x: number[]) => {
        let val = intercept;
        for (let j = 0; j < finalBasis.length; j++) {
            val += coeffs[j] * evalBasis(finalBasis[j], x);
        }
        return val;
    };

    const trainPreds = trainX.map(predict);
    const testPreds = testX.map(predict);

    const trainMetrics = regressionMetrics(trainY, trainPreds);
    const metrics = regressionMetrics(testY, testPreds);
    log(`[MARS] 测试集 R²=${metrics.r2}，RMSE=${metrics.rmse} | 训练集 R²=${trainMetrics.r2}`);

    // ── 基函数表 ──
    const basisDescription = (bf: BasisFunction): string => {
        return bf.components.map(c => {
            const fname = featNames[c.featureIdx] || `x${c.featureIdx}`;
            return c.sign === 1
                ? `max(0, ${fname} - ${c.knot.toFixed(3)})`
                : `max(0, ${c.knot.toFixed(3)} - ${fname})`;
        }).join(" × ");
    };

    const basisRule = (bf: BasisFunction): string => {
        return bf.components.map(c => {
            const fname = featNames[c.featureIdx] || `x${c.featureIdx}`;
            return c.sign === 1
                ? `${fname} > ${c.knot.toFixed(3)}`
                : `${fname} < ${c.knot.toFixed(3)}`;
        }).join("  且  ");
    };

    const basisTableRows: (string | number)[][] = finalBasis
        .map((bf, i) => [
            `BF${i + 1}`,
            basisDescription(bf),
            basisRule(bf),
            Number(bf.coeff.toFixed(4)),
            Number(Math.abs(bf.coeff).toFixed(4)),
        ])
        .sort((a, b) => (b[4] as number) - (a[4] as number));

    // ── 特征重要度（按特征出现在基函数中的频率 × |coeff| 加权）──
    const featureImportance = new Map<string, number>();
    for (const bf of finalBasis) {
        for (const c of bf.components) {
            const fname = featNames[c.featureIdx] || `x${c.featureIdx}`;
            featureImportance.set(fname, (featureImportance.get(fname) || 0) + Math.abs(bf.coeff));
        }
    }
    const importanceArr = [...featureImportance.entries()].sort((a, b) => b[1] - a[1]);
    const maxImp = Math.max(...importanceArr.map(i => i[1]), 1e-10);

    // ── 散点图 ──
    const scatterData = testY.map((actual, i) => [Number(actual.toFixed(3)), Number(testPreds[i].toFixed(3))]);
    const allVals = [...scatterData.map(d => d[0]), ...scatterData.map(d => d[1])];
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);

    // ── 残差图 ──
    const residualData = testY.map((actual, i) => [Number(testPreds[i].toFixed(3)), Number((actual - testPreds[i]).toFixed(3))]);

    // ── PDP: 对最重要的前 3 个特征画 MARS 的偏依赖曲线 ──
    const pdpFigures: AnalysisResult["figures"] = [];
    const topFeats = importanceArr.slice(0, 3);
    for (const [fname, _imp] of topFeats) {
        const fidx = featNames.indexOf(fname);
        if (fidx < 0) continue;
        const vals = trainX.map(r => r[fidx]);
        const sorted = [...new Set(vals)].sort((a, b) => a - b);
        const step = Math.max(1, Math.floor(sorted.length / 40));
        const gridVals = sorted.filter((_, i) => i % step === 0);
        if (gridVals.length < 3) continue;

        const pdpPoints: [number, number][] = gridVals.map(gv => {
            let sum = 0;
            for (const row of trainX) {
                const modified = [...row];
                modified[fidx] = gv;
                sum += predict(modified);
            }
            return [Number(gv.toFixed(4)), Number((sum / trainX.length).toFixed(4))];
        });

        // 找到 knot 位置
        const knotsOnFeat = finalBasis
            .flatMap(bf => bf.components.filter(c => c.featureIdx === fidx).map(c => c.knot));
        const uniqueKnots = [...new Set(knotsOnFeat)];

        const markLines = uniqueKnots.map(k => ({ xAxis: Number(k.toFixed(3)), name: `拐点 ${k.toFixed(2)}` }));

        pdpFigures.push({
            title: `📈 MARS 偏依赖 - ${fname}`,
            explanation: `展示 ${fname} 单独变化时模型预测均值的变化趋势，橙色虚线标出算法自动发现的拐点（Knot）位置。拐点两侧斜率不同，说明该特征存在非线性效应。`,
            type: "echarts",
            option: {
                tooltip: { trigger: "axis" },
                xAxis: { name: fname, type: "value" },
                yAxis: { name: "预测均值" },
                series: [
                    { type: "line", data: pdpPoints, smooth: false, areaStyle: { opacity: 0.1 } },
                    ...(markLines.length > 0 ? [{
                        type: "line" as const,
                        data: [] as any[],
                        markLine: {
                            silent: true,
                            lineStyle: { type: "dashed" as const, color: "#e67e22", width: 2 },
                            data: markLines,
                        },
                    }] : []),
                ],
                grid: { left: 60, right: 20, top: 30, bottom: 40 },
            },
        });
    }

    // ── 组装输出 ──
    const tables: AnalysisResult["tables"] = [
        {
            title: "📊 回归评估指标",
            columns: ["指标", "测试集", "训练集"],
            rows: [
                ["R² (决定系数)", metrics.r2, trainMetrics.r2],
                ["RMSE (均方根误差)", metrics.rmse, trainMetrics.rmse],
                ["MAE (平均绝对误差)", metrics.mae, trainMetrics.mae],
                ["基函数数量", finalBasis.length, finalBasis.length],
                ["样本数量", testY.length, trainY.length],
            ],
        },
        {
            title: "🧩 MARS 基函数详情",
            explanation:
                "每一行代表模型中一个「分段线性片段」。" +
                "【基函数表达式】是数学定义（铰链函数），【激活条件】是白话翻译——告诉你什么区间内该段起作用。" +
                "【系数】越大影响越大；正系数=该段拉高预测，负系数=该段拉低预测。",
            columns: ["编号", "基函数表达式", "激活条件（可读规则）", "系数", "|系数|"],
            rows: basisTableRows.length > 0 ? basisTableRows : [["—", "模型退化为常数（截距）", "—", intercept, "—"]],
        },
        {
            title: "⚡ 特征重要度排名",
            explanation: "按每个特征在基函数中出现的频率 × 系数绝对值加权聚合。越高说明该特征对模型贡献越大。",
            columns: ["排名", "特征", "重要度得分", "相对强度 (%)"],
            rows: importanceArr.map(([fname, imp], i) => [
                i + 1, fname, Number(imp.toFixed(4)), `${(imp / maxImp * 100).toFixed(1)}%`,
            ]),
        },
    ];

    const warnings: string[] = [];
    if (trainMetrics.r2 - metrics.r2 > 0.2) warnings.push(`⚠️ 过拟合风险：训练R²(${trainMetrics.r2}) 远高于测试R²(${metrics.r2})，考虑减少最大基函数数或增加数据`);
    if (metrics.r2 < 0.3) warnings.push("模型解释力很弱（R² < 0.3），当前特征可能不足以解释目标变量波动");
    if (finalBasis.length === 0) warnings.push("剪枝后所有基函数被移除，模型退化为常数截距，建议检查数据质量或增大最大基函数数");

    const figures: AnalysisResult["figures"] = [
        {
            title: "🎯 预测 vs 实际（测试集）",
            explanation: "散点越接近红色对角线说明预测越准确。偏离对角线的点代表模型预测有偏差的样本。",
            type: "echarts",
            option: {
                tooltip: { formatter: (p: any) => `实际: ${p.value[0]}<br/>预测: ${p.value[1]}` },
                xAxis: { name: "实际值", type: "value", min: (v: any) => v.min, max: (v: any) => v.max },
                yAxis: { name: "预测值", type: "value", min: (v: any) => v.min, max: (v: any) => v.max },
                series: [
                    { type: "scatter", data: scatterData, symbolSize: 7, itemStyle: { color: "rgba(99,102,241,0.7)" } },
                    { type: "line", data: [[minV, minV], [maxV, maxV]], lineStyle: { type: "dashed", color: "#ef4444", width: 2 }, symbol: "none" },
                ],
                grid: { left: 60, right: 20, top: 30, bottom: 50 },
            },
        },
        {
            title: "📉 残差分布",
            explanation: "残差（实际-预测）应随机地散落在零线附近。若出现喇叭形或弯曲趋势，说明模型存在系统性偏差。",
            type: "echarts",
            option: {
                tooltip: { formatter: (p: any) => `预测: ${p.value[0]}<br/>残差: ${p.value[1]}` },
                xAxis: { name: "预测值", type: "value" },
                yAxis: { name: "残差", type: "value" },
                series: [
                    { type: "scatter", data: residualData, symbolSize: 7, itemStyle: { color: (p: any) => p.value[1] > 0 ? "rgba(16,185,129,0.7)" : "rgba(239,68,68,0.7)" } },
                    { type: "line", data: [[Math.min(...residualData.map(d => d[0])), 0], [Math.max(...residualData.map(d => d[0])), 0]], lineStyle: { type: "dashed", color: "#94a3b8" }, symbol: "none" },
                ],
                grid: { left: 60, right: 20, top: 30, bottom: 50 },
            },
        },
        ...pdpFigures,
        {
            title: "⚡ 特征重要度",
            explanation: "横向条形图展示各特征的综合贡献度。条形越长的特征对目标的影响越大（包含非线性与交互效应）。",
            type: "echarts",
            option: {
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                yAxis: { type: "category", data: importanceArr.map(i => i[0]).reverse() },
                xAxis: { type: "value", name: "重要度" },
                series: [{
                    type: "bar",
                    data: importanceArr.map(i => Number(i[1].toFixed(4))).reverse(),
                    itemStyle: { color: "#6366f1" },
                    label: { show: true, position: "right", fontSize: 10, formatter: (p: any) => p.data.toFixed(3) },
                }],
                grid: { left: 100, right: 60, top: 10, bottom: 30 },
            },
        },
    ];

    const knotSummary = finalBasis.length > 0
        ? `模型包含 ${finalBasis.length} 个基函数，` +
        `涉及 ${importanceArr.length} 个特征。` +
        (importanceArr.length > 0 ? `最重要的特征: ${importanceArr[0][0]}。` : "")
        : "模型退化为常数。";

    return {
        tables,
        figures,
        assumptions: [
            "MARS 假设目标与特征之间存在分段线性关系",
            `最大交互阶数: ${maxInteraction}（1=仅主效应，2+=含交互）`,
            `特征缩放: ${params.scale || "none"}，缺失值: ${impute}`,
        ],
        warnings,
        narrative:
            `MARS 回归 | 测试集 R²=${metrics.r2}，RMSE=${metrics.rmse}。${knotSummary} ` +
            `${trainMetrics.r2 - metrics.r2 > 0.15 ? "⚠️ 存在一定过拟合倾向。" : "训练/测试表现一致，泛化良好。"}`,
        citation: spec.citation,
        extras: {
            modelPackage: {
                type: "mars",
                algoId: spec.id,
                createdAt: new Date().toISOString(),
                featureNames: featNames,
                target,
                basis: finalBasis.map((bf, i) => ({
                    components: bf.components.map(c => ({
                        feature: featNames[c.featureIdx],
                        featureIdx: c.featureIdx,
                        knot: c.knot,
                        sign: c.sign,
                    })),
                    coeff: coeffs[i],
                })),
                intercept,
                scaler,
                pipeline,
                metrics,
            },
        },
    };
}

export default { spec, run };
