import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
// @ts-ignore — node-fpgrowth has no type declarations
import { FPGrowth } from "node-fpgrowth";
import { processMLFeatures } from "../utils";

/* ════════════════════════════════════════════════════════
   关联规则挖掘 (FP-Growth)
   ════════════════════════════════════════════════════════ */
const spec: AlgorithmSpec = {
    id: "ml.aprioriRule",
    name: "关联规则挖掘 (FP-Growth)",
    category: "ml",
    subcategory: "diagnosis",
    description: "不依赖任何回归模型或 R²，直接挖掘工艺参数与结果之间的关联规则。",
    explanation:
        "一种「无监督数据挖掘」算法。它不建立预测模型（完全摆脱低 R² 限制），" +
        "而是统计『当参数同时处于某个区间时，目标结果必然怎样』的" +
        "共现频率和置信度，适合发现明确的经验规则。",
    inputSpec: [
        { id: "target", label: "目标变量", acceptedTypes: ["numeric", "categorical"], min: 1, max: 1 },
        { id: "features", label: "工艺/设备参数", acceptedTypes: ["numeric", "categorical"], min: 1 },
    ],
    paramSchema: [
        {
            key: "targetDirection", label: "目标方向", type: "select", options: [
                { label: "越高越好（如良率、强度）", value: "higher" },
                { label: "越低越好（如能耗、缺陷率、ppm）", value: "lower" },
            ], default: "higher"
        },
        { key: "minSupport", label: "最小支持度", type: "number", default: 0.05, min: 0.01, max: 0.5, step: 0.01 },
        { key: "minConfidence", label: "最小置信度", type: "number", default: 0.5, min: 0.1, max: 1.0, step: 0.05 },
        { key: "targetBins", label: "目标分箱数", type: "number", default: 3, min: 2, max: 5, step: 1 },
        { key: "featureBins", label: "特征分箱数", type: "number", default: 3, min: 2, max: 5, step: 1 },
        {
            key: "impute", label: "缺失值填补", type: "select", options: [
                { label: "均值", value: "mean" },
                { label: "中位数", value: "median" },
                { label: "补零", value: "zero" },
            ], default: "mean"
        },
        { key: "oneHot", label: "自动独热编码（分类特征）", type: "boolean", default: false },
    ],
    citation: "基于 FP-Growth 算法的工业关联规则挖掘",
};

/* ── 分位数分箱 ── */
interface BinSpec { label: string; range: string; lo: number; hi: number }

function buildBins(values: number[], numBins: number, colName: string): { bins: BinSpec[]; fn: (v: number) => string } {
    const sorted = values.filter(v => isFinite(v)).sort((a, b) => a - b);
    if (sorted.length === 0) return { bins: [], fn: () => `${colName}:缺失` };

    // 用分位数切出 numBins 段
    const cuts: number[] = [];
    for (let i = 1; i < numBins; i++) {
        cuts.push(sorted[Math.floor(sorted.length * i / numBins)]);
    }
    // 去重
    const uniqueCuts = [...new Set(cuts)].sort((a, b) => a - b);

    if (uniqueCuts.length === 0) {
        // 所有值一样
        const label = `${colName}:全等(${sorted[0].toFixed(2)})`;
        return { bins: [{ label, range: `= ${sorted[0].toFixed(2)}`, lo: -Infinity, hi: Infinity }], fn: () => label };
    }

    const bins: BinSpec[] = [];
    const tagNames = uniqueCuts.length === 1
        ? ["低", "高"]
        : uniqueCuts.length === 2
            ? ["低", "中", "高"]
            : Array.from({ length: uniqueCuts.length + 1 }, (_, i) => `段${i + 1}`);

    // first bin
    bins.push({
        label: `${colName}:${tagNames[0]}(<${uniqueCuts[0].toFixed(2)})`,
        range: `< ${uniqueCuts[0].toFixed(2)}`,
        lo: -Infinity,
        hi: uniqueCuts[0],
    });
    // middle bins
    for (let i = 1; i < uniqueCuts.length; i++) {
        bins.push({
            label: `${colName}:${tagNames[i]}(${uniqueCuts[i - 1].toFixed(2)}~${uniqueCuts[i].toFixed(2)})`,
            range: `${uniqueCuts[i - 1].toFixed(2)} ~ ${uniqueCuts[i].toFixed(2)}`,
            lo: uniqueCuts[i - 1],
            hi: uniqueCuts[i],
        });
    }
    // last bin
    bins.push({
        label: `${colName}:${tagNames[tagNames.length - 1]}(≥${uniqueCuts[uniqueCuts.length - 1].toFixed(2)})`,
        range: `≥ ${uniqueCuts[uniqueCuts.length - 1].toFixed(2)}`,
        lo: uniqueCuts[uniqueCuts.length - 1],
        hi: Infinity,
    });

    const fn = (v: number): string => {
        if (!isFinite(v)) return `${colName}:缺失`;
        for (let i = 0; i < bins.length - 1; i++) {
            if (v < bins[i].hi) return bins[i].label;
        }
        return bins[bins.length - 1].label;
    };

    return { bins, fn };
}

/* ── 人类友好展示 ── */
function humanize(token: string): string {
    const colonIdx = token.indexOf(":");
    if (colonIdx > 0) {
        const col = token.substring(0, colonIdx);
        const desc = token.substring(colonIdx + 1);
        return `${col} ∈ ${desc}`;
    }
    return token;
}

/* ── 主函数 ── */
async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
    const log = (msg: string) => { if (onLog) onLog(msg); };
    const targetCol = variables["target"]?.[0];
    const feats: string[] = variables["features"] || [];
    if (!targetCol || feats.length === 0) throw new Error("请指定目标变量和至少一个特征");

    const higherBetter = params.targetDirection !== "lower";
    const dirLabel = higherBetter ? "越高越好" : "越低越好";
    const minSupport = Number(params.minSupport) || 0.05;
    const minConfidence = Number(params.minConfidence) || 0.5;
    const targetBinCount = Number(params.targetBins) || 3;
    const featureBinCount = Number(params.featureBins) || 3;
    const impute = params.impute || "mean";

    const rawRows: Record<string, any>[] = dataset;
    const N = rawRows.length;
    if (N < 20) throw new Error("数据量过小（< 20 行），无法进行关联规则挖掘");

    log(`[准备] ${N} 行, 目标: ${targetCol}(${dirLabel}), 特征: ${feats.length} 个`);

    // ── 1. 特征工程：缺失值处理 + 数据质量检测 ──
    log(`[特征工程] 缺失值策略: ${impute}`);

    // 统计数据质量
    const qualityRows: (string | number)[][] = [];
    const qualityWarnings: string[] = [];
    for (const col of [targetCol, ...feats]) {
        const vals = rawRows.map(r => r[col]);
        const total = vals.length;
        const missing = vals.filter(v => v == null || v === "" || (typeof v === "number" && isNaN(v))).length;
        const missingPct = (missing / total * 100).toFixed(1);
        const nums = vals.map(v => Number(v)).filter(v => isFinite(v));
        const isNumeric = nums.length > total * 0.5;
        const unique = new Set(vals.filter(v => v != null && v !== "")).size;

        qualityRows.push([
            col,
            isNumeric ? "数值" : "类别",
            total,
            `${missing} (${missingPct}%)`,
            unique,
            isNumeric ? Number(Math.min(...nums).toFixed(3)) : "—",
            isNumeric ? Number(Math.max(...nums).toFixed(3)) : "—",
        ]);

        if (missing / total > 0.3) qualityWarnings.push(`⚠️ ${col} 缺失率高达 ${missingPct}%`);
        if (unique <= 1) qualityWarnings.push(`⚠️ ${col} 仅有 ${unique} 个不同值，无区分力`);
    }

    // ── 2. 分箱离散化 ──
    log(`[分箱] 目标 ${targetBinCount} 箱, 特征 ${featureBinCount} 箱`);

    // 目标列分箱
    const targetNums = rawRows.map(r => Number(r[targetCol])).filter(v => isFinite(v));
    const isTargetNumeric = targetNums.length > N * 0.5;

    let targetBinFn: (v: any) => string;
    let targetBinInfo: BinSpec[] = [];

    if (isTargetNumeric) {
        const { bins, fn } = buildBins(targetNums, targetBinCount, targetCol);
        targetBinFn = (v: any) => {
            const n = Number(v);
            return isFinite(n) ? fn(n) : `${targetCol}:缺失`;
        };
        targetBinInfo = bins;
        log(`[分箱] 目标 ${targetCol} 切分为 ${bins.length} 区间: ${bins.map(b => b.range).join(" | ")}`);
    } else {
        // 类别型目标
        targetBinFn = (v: any) => `${targetCol}:${v}`;
        const uniq = [...new Set(rawRows.map(r => r[targetCol]).filter(v => v != null))];
        targetBinInfo = uniq.map(u => ({ label: `${targetCol}:${u}`, range: `= ${u}`, lo: 0, hi: 0 }));
    }

    // 特征列分箱
    const featureBinFns: Record<string, (v: any) => string> = {};
    const allBinInfo: { col: string; label: string; range: string }[] = [];

    for (const col of feats) {
        const vals = rawRows.map(r => r[col]);
        const nums = vals.map(v => Number(v)).filter(v => isFinite(v));
        const isNum = nums.length > vals.length * 0.5;

        if (isNum) {
            const { bins, fn } = buildBins(nums, featureBinCount, col);
            featureBinFns[col] = (v: any) => {
                const n = Number(v);
                return isFinite(n) ? fn(n) : `${col}:缺失`;
            };
            allBinInfo.push(...bins.map(b => ({ col, label: b.label, range: b.range })));
        } else {
            featureBinFns[col] = (v: any) => `${col}:${v}`;
            const uniq = [...new Set(vals.filter(v => v != null && v !== "").map(String))];
            allBinInfo.push(...uniq.map(u => ({ col, label: `${col}:${u}`, range: `类别 "${u}"` })));
        }
    }

    // 加入目标分箱信息
    allBinInfo.push(...targetBinInfo.map(b => ({ col: targetCol, label: b.label, range: b.range })));

    // ── 3. 构建事务 ──
    const transactions: string[][] = [];
    for (const row of rawRows) {
        const t: string[] = [];
        for (const f of feats) {
            if (row[f] != null && row[f] !== "") {
                const token = featureBinFns[f](row[f]);
                if (!token.includes("缺失")) t.push(token);
            }
        }
        if (row[targetCol] != null && row[targetCol] !== "") {
            const token = targetBinFn(row[targetCol]);
            if (!token.includes("缺失")) t.push(token);
        }
        if (t.length >= 2) transactions.push(t);
    }

    const totalTrans = transactions.length;
    log(`[事务] 有效事务 ${totalTrans} 条`);
    if (totalTrans < 10) throw new Error("有效事务不足 10 条");

    // ── 4. FP-Growth ──
    log(`[挖掘] FP-Growth 频繁项集搜索（支持度 ≥ ${minSupport}）...`);
    const fpgrowth = new FPGrowth<string>(minSupport);
    const itemsets: { items: string[]; support: number }[] = await new Promise((resolve, reject) => {
        fpgrowth.exec(transactions).then((res: any) => resolve(res)).catch((err: any) => reject(err));
    });
    log(`[挖掘] 找到 ${itemsets.length} 个频繁项集`);

    // ── 5. 提取 X → Target 关联规则 ──
    const targetPrefix = `${targetCol}:`;

    // 预计算 token → 索引集
    const tokenIndex = new Map<string, Set<number>>();
    for (let i = 0; i < totalTrans; i++) {
        for (const tok of transactions[i]) {
            if (!tokenIndex.has(tok)) tokenIndex.set(tok, new Set());
            tokenIndex.get(tok)!.add(i);
        }
    }

    const intersectSets = (sets: Set<number>[]): Set<number> => {
        if (sets.length === 0) return new Set();
        let result = new Set(sets[0]);
        for (let i = 1; i < sets.length; i++) {
            const next = new Set<number>();
            for (const v of result) { if (sets[i].has(v)) next.add(v); }
            result = next;
        }
        return result;
    };

    interface Rule {
        lhs: string[];
        rhs: string;
        countX: number;
        countXY: number;
        countY: number;
        confidence: number;
        lift: number;
        isFavorable: boolean;
    }

    const rules: Rule[] = [];
    const seen = new Set<string>();

    // 确定"有利"目标区间
    const favorableTargetTokens = new Set<string>();
    const unfavorableTargetTokens = new Set<string>();
    if (isTargetNumeric && targetBinInfo.length >= 2) {
        if (higherBetter) {
            favorableTargetTokens.add(targetBinInfo[targetBinInfo.length - 1].label); // 高区间
            unfavorableTargetTokens.add(targetBinInfo[0].label); // 低区间
        } else {
            favorableTargetTokens.add(targetBinInfo[0].label); // 低区间 = 好
            unfavorableTargetTokens.add(targetBinInfo[targetBinInfo.length - 1].label); // 高区间 = 差
        }
    }

    for (const itemset of itemsets) {
        const items: string[] = itemset.items;
        if (items.length < 2) continue;

        const targetTokens = items.filter(i => i.startsWith(targetPrefix));
        if (targetTokens.length !== 1) continue;

        const rhs = targetTokens[0];
        const lhs = items.filter(i => i !== rhs);
        if (lhs.length === 0) continue;

        const key = [...lhs].sort().join("||") + "=>" + rhs;
        if (seen.has(key)) continue;
        seen.add(key);

        const lhsSets = lhs.map(t => tokenIndex.get(t) || new Set<number>());
        const rhsSet = tokenIndex.get(rhs) || new Set<number>();

        const xSet = intersectSets(lhsSets);
        const countX = xSet.size;
        if (countX === 0) continue;

        const xySet = intersectSets([xSet, rhsSet]);
        const countXY = xySet.size;
        const countY = rhsSet.size;

        const confidence = countXY / countX;
        if (confidence < minConfidence) continue;

        const lift = (countXY / totalTrans) / ((countX / totalTrans) * (countY / totalTrans));
        // lift ≈ 1 且置信度 ≈ 基础概率 → 无意义的规则，过滤掉
        if (Math.abs(lift - 1.0) < 0.05) continue;

        const isFavorable = favorableTargetTokens.has(rhs);

        rules.push({ lhs, rhs, countX, countXY, countY, confidence, lift, isFavorable });
    }

    // 按 lift 降序
    rules.sort((a, b) => b.lift - a.lift || b.confidence - a.confidence);
    const topRules = rules.slice(0, 30);
    log(`[结果] ${rules.length} 条有效规则，输出 Top ${topRules.length}`);

    // ── 6. 按目标方向提取最优/最差工况 ──
    const favorableRules = rules.filter(r => favorableTargetTokens.has(r.rhs)).sort((a, b) => b.lift - a.lift);
    const unfavorableRules = rules.filter(r => unfavorableTargetTokens.has(r.rhs)).sort((a, b) => b.lift - a.lift);

    const bestRule = favorableRules[0] || null;
    const worstRule = unfavorableRules[0] || null;

    // ── 7. 格式化输出 ──

    // 工况诊断行
    const scenarioRows: (string | number)[][] = [];
    if (bestRule) {
        scenarioRows.push([
            "🏆 最优工况",
            bestRule.lhs.map(humanize).join("  且  "),
            humanize(bestRule.rhs),
            `${(bestRule.confidence * 100).toFixed(1)}%`,
            `${bestRule.countXY} (${(bestRule.countXY / totalTrans * 100).toFixed(1)}%)`,
            bestRule.lift.toFixed(2),
            "✅ 标杆：维持此组合",
        ]);
    }
    if (worstRule) {
        scenarioRows.push([
            "⚠️ 最差工况",
            worstRule.lhs.map(humanize).join("  且  "),
            humanize(worstRule.rhs),
            `${(worstRule.confidence * 100).toFixed(1)}%`,
            `${worstRule.countXY} (${(worstRule.countXY / totalTrans * 100).toFixed(1)}%)`,
            worstRule.lift.toFixed(2),
            "⚠️ 预警：优先排查",
        ]);
    }

    // 主规则表
    const ruleRows: (string | number)[][] = topRules.map((r, i) => {
        const isFav = favorableTargetTokens.has(r.rhs);
        const isUnfav = unfavorableTargetTokens.has(r.rhs);
        const tag = r.lift > 1.5 && isFav ? "⭐ 有利强关联"
            : r.lift > 1.5 && isUnfav ? "🔴 不利强关联"
                : r.lift > 1.0 && isFav ? "✅ 正关联"
                    : r.lift > 1.0 && isUnfav ? "⚠️ 不利关联"
                        : "—";
        return [
            i + 1,
            r.lhs.map(humanize).join("  且  "),
            humanize(r.rhs),
            `${(r.confidence * 100).toFixed(1)}%`,
            `${r.countXY} (${(r.countXY / totalTrans * 100).toFixed(1)}%)`,
            r.lift.toFixed(2),
            tag,
        ];
    });

    // 分箱参考表
    const binTableRows = allBinInfo.map(b => [b.col, b.label.replace(`${b.col}:`, ""), b.range]);

    // ── 8. 可视化 ──
    const figures: AnalysisResult["figures"] = [];

    if (topRules.length > 1) {
        // 气泡图
        figures.push({
            title: "📊 关联规则分布（置信度 vs Lift）",
            explanation: "每个气泡代表一条关联规则。横轴置信度，纵轴 Lift 提升度，气泡大小=频次。右上角=最有价值。绿色=有利，红色=不利。",
            type: "echarts",
            option: {
                tooltip: { trigger: "item" },
                xAxis: { name: "置信度", type: "value", min: 0, max: 1, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%` } },
                yAxis: { name: "Lift 提升度", type: "value" },
                series: [{
                    type: "scatter",
                    symbolSize: (d: number[]) => Math.max(8, Math.min(40, Math.sqrt(d[2]) * 3)),
                    data: topRules.map((r, i) => [r.confidence, r.lift, r.countXY, i + 1]),
                    itemStyle: {
                        color: (p: any) => {
                            const idx = p.dataIndex;
                            if (idx < topRules.length && favorableTargetTokens.has(topRules[idx].rhs)) return "#22c55e";
                            if (idx < topRules.length && unfavorableTargetTokens.has(topRules[idx].rhs)) return "#ef4444";
                            return "#6366f1";
                        },
                    },
                }],
                grid: { left: 60, right: 20, top: 30, bottom: 50 },
            },
        });

        // Top 10 Lift 条形图
        const top10 = topRules.slice(0, 10);
        figures.push({
            title: "🏅 Top 10 规则 Lift 排行",
            explanation: "Lift > 1 表示正向关联（比随机强），越大越有意义。颜色区分有利（绿）/ 不利（红）规则。",
            type: "echarts",
            option: {
                tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
                yAxis: {
                    type: "category",
                    data: top10.map((_, i) => `#${i + 1}`).reverse(),
                },
                xAxis: { type: "value", name: "Lift" },
                series: [{
                    type: "bar",
                    data: top10.map(r => ({
                        value: Number(r.lift.toFixed(2)),
                        itemStyle: {
                            color: favorableTargetTokens.has(r.rhs) ? "#22c55e"
                                : unfavorableTargetTokens.has(r.rhs) ? "#ef4444" : "#6366f1",
                        },
                    })).reverse(),
                    label: { show: true, position: "right", fontSize: 11 },
                }],
                grid: { left: 50, right: 60, top: 20, bottom: 30 },
            },
        });
    }

    // narrative
    let narrative = `目标方向: ${dirLabel}。共发现 ${rules.length} 条有效关联规则。`;
    if (bestRule) {
        narrative += `\n\n🏆 最优工况: 当 ${bestRule.lhs.map(humanize).join(" 且 ")} 时，有 ${(bestRule.confidence * 100).toFixed(1)}% 概率达到${higherBetter ? "高" : "低"}目标（Lift=${bestRule.lift.toFixed(2)}，发生 ${bestRule.countXY} 次）。`;
    }
    if (worstRule) {
        narrative += `\n\n⚠️ 最差工况: 当 ${worstRule.lhs.map(humanize).join(" 且 ")} 时，有 ${(worstRule.confidence * 100).toFixed(1)}% 概率导致${higherBetter ? "低" : "高"}目标（Lift=${worstRule.lift.toFixed(2)}，发生 ${worstRule.countXY} 次）。`;
    }

    const warnings = [...qualityWarnings];
    if (rules.length === 0) warnings.push("未挖掘出任何规则，请调低「最小支持度 / 最小置信度」或增加数据。");
    if (totalTrans < 100) warnings.push(`有效事务仅 ${totalTrans} 条，规则置信度可能不够稳定。`);

    return {
        tables: [
            {
                title: `🏭 工况诊断（目标: ${targetCol}，方向: ${dirLabel}）`,
                explanation:
                    "基于关联规则自动发现的最优/最差工况组合，不依赖回归模型。" +
                    "【置信度】= 满足条件时结果发生的概率。" +
                    "【Lift】= 相比随机的提升倍数（>1 有正向关联）。",
                columns: ["诊断", "工况条件", "目标结果", "置信度", "出现次数(占比)", "Lift", "建议"],
                rows: scenarioRows.length > 0 ? scenarioRows : [["—", "未发现可靠工况规则", "—", "—", "—", "—", "请降低参数或增加数据"]],
            },
            {
                title: "🔗 关联规则诊断（条件 → 结果）",
                explanation:
                    "完全不依赖回归拟合的频率统计关联规则。" +
                    "已自动过滤 Lift ≈ 1.0 的无意义规则（与随机基准无差异）。",
                columns: ["排名", "当满足条件…", "则结果为…", "置信度", "出现次数(占比)", "Lift", "判定"],
                rows: ruleRows.length > 0 ? ruleRows : [["—", "未发现满足门槛的规则", "—", "—", "—", "—", "请降低参数"]],
            },
            {
                title: "📐 分箱参考表（数值 → 区间对照）",
                explanation: "系统按分位数自动把连续变量切分成若干区间。此表列出具体数值范围。",
                columns: ["变量", "区间标签", "数值范围"],
                rows: binTableRows,
            },
            {
                title: "🩺 数据质量体检",
                columns: ["变量", "类型", "总数", "缺失", "唯一值数", "最小值", "最大值"],
                rows: qualityRows,
            },
        ],
        figures,
        narrative,
        warnings,
        assumptions: [
            `目标方向: ${dirLabel}`,
            "关联规则基于 FP-Growth 频繁项集挖掘算法",
            "连续型变量经过分位数分箱离散化处理",
            "已过滤 Lift ≈ 1.0 的无区分力规则",
            "置信度和 Lift 均基于频率统计，非因果推断",
        ],
        citation: spec.citation,
    };
}

export default { spec, run };
