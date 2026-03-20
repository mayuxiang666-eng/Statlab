import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.anova",
  name: "单因素 ANOVA",
  category: "academic",
  subcategory: "inference",
  description: "F 值 + 事后检验 (Tukey 简化)",
  explanation: "这是 t检验 的进阶版，专门用来比对「三组及以上」对象（比如：北京、上海、广州、深圳四个城市的工资有显著差异吗？）。当你有很多个类别想要一分高下时，方差分析能快速告诉你它们之中有没有真正的“突变”梯队。",
  inputSpec: [
    { id: "target", label: "因变量", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "factor", label: "分组变量", acceptedTypes: ["categorical"], min: 1, max: 1 }
  ],
  paramSchema: [],
  citation: "Fisher, R.A. (1925)."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const yVar = variables["target"]?.[0];
  const factor = variables["factor"]?.[0];
  if (!yVar || !factor) throw new Error("缺少变量");

  const groups: Record<string, number[]> = {};
  dataset.forEach((row) => {
    const g = row[factor];
    if (!groups[g]) groups[g] = [];
    const val = Number(row[yVar]);
    if (!isNaN(val)) groups[g].push(val);
  });
  const groupNames = Object.keys(groups);
  const allValues = groupNames.flatMap((g) => groups[g]);
  const grandMean = mean(allValues);
  const ssBetween = groupNames.reduce((acc, g) => acc + groups[g].length * (mean(groups[g]) - grandMean) ** 2, 0);
  const ssWithin = groupNames.reduce((acc, g) => acc + variance(groups[g]) * (groups[g].length - 1), 0);
  const dfBetween = groupNames.length - 1;
  const dfWithin = allValues.length - groupNames.length;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const F = msWithin === 0 ? 0 : msBetween / msWithin;

  const posthoc: (string | number)[][] = [];
  for (let i = 0; i < groupNames.length; i++) {
    for (let j = i + 1; j < groupNames.length; j++) {
      const g1 = groupNames[i];
      const g2 = groupNames[j];
      const diff = mean(groups[g1]) - mean(groups[g2]);
      const se = Math.sqrt(msWithin / groups[g1].length + msWithin / groups[g2].length);
      const t = diff / se;
      posthoc.push([`${g1}-${g2}`, Number(diff.toFixed(3)), Number(t.toFixed(3))]);
    }
  }

  return {
    tables: [
      {
        title: "ANOVA",
        columns: ["来源", "SS", "df", "MS", "F"],
        rows: [
          ["组间", Number(ssBetween.toFixed(3)), dfBetween, Number(msBetween.toFixed(3)), Number(F.toFixed(3))],
          ["组内", Number(ssWithin.toFixed(3)), dfWithin, Number(msWithin.toFixed(3)), "-"],
          ["合计", Number((ssBetween + ssWithin).toFixed(3)), dfBetween + dfWithin, "-", "-"]
        ]
      },
      { title: "事后 (Tukey 简化)", columns: ["对比", "均值差", "t"], rows: posthoc }
    ],
    figures: [],
    assumptions: ["正态性", "方差齐性", "独立样本"],
    warnings: [],
    narrative: "F 较大且p<0.05 表示至少一组均值差异显著。事后检验帮助定位差异来源。",
    citation: spec.citation
  };
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);
}

function variance(arr: number[]) {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  return arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
}

export default { spec, run };
