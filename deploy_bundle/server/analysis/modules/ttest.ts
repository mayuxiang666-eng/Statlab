import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import * as ss from "simple-statistics";
import { numericValues } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.ttest",
  name: "t检验",
  category: "academic",
  subcategory: "inference",
  description: "单样本/独立样本/配对",
  explanation: "专门用来比较「两组对象」的区别是否明显（比如：A班和B班的平均成绩有差别吗？男生和女生的工资有差别吗？）。它会科学地告诉你，差距是确实存在，还是纯属巧合跑出来的虚假差异。",
  inputSpec: [
    { id: "target", label: "目标变量", acceptedTypes: ["numeric"], min: 1, max: 1 },
    { id: "group", label: "分组变量(可选)", acceptedTypes: ["categorical"], min: 0, max: 1 },
    { id: "paired", label: "配对变量(可选)", acceptedTypes: ["numeric"], min: 0, max: 1 }
  ],
  paramSchema: [
    { key: "mu", label: "单样本假设均值", type: "number", default: 0 },
    { key: "equalVar", label: "方差齐性(独立样本)", type: "boolean", default: true }
  ],
  citation: "Student (1908)."
};

async function run({ dataset, variables, params }: any): Promise<AnalysisResult> {
  const target = variables["target"]?.[0];
  if (!target) throw new Error("缺少目标变量");
  const group = variables["group"]?.[0];
  const paired = variables["paired"]?.[0];
  const mu = Number(params.mu ?? 0);
  const equalVar = Boolean(params.equalVar ?? true);

  if (paired) {
    const x = numericValues(dataset, target);
    const y = numericValues(dataset, paired);
    const diff = x.map((v, i) => v - (y[i] ?? 0));
    const t = ss.tTest(diff, 0);
    return formatResult([["配对", t, diff.length - 1, pFromT(t, diff.length - 1)]]);
  }

  if (group) {
    const groups: Record<string, number[]> = {};
    dataset.forEach((row) => {
      const g = row[group];
      if (!groups[g]) groups[g] = [];
      const val = Number(row[target]);
      if (!isNaN(val)) groups[g].push(val);
    });
    const [g1, g2] = Object.keys(groups);
    const x = groups[g1] || [];
    const y = groups[g2] || [];
    const t = ss.tTestTwoSample(x, y, equalVar ? 0 : 1); // third param is equalVariance boolean as number for shim
    const df = x.length + y.length - 2;
    return formatResult([[`${g1} vs ${g2}`, t, df, pFromT(t, df)]]);
  }

  const values = numericValues(dataset, target);
  const t = ss.tTest(values, mu);
  return formatResult([["单样本", t, values.length - 1, pFromT(t, values.length - 1)]]);
}

function pFromT(t: number, df: number) {
  const x = Math.abs(t);
  // 使用正态近似的双侧 p 值，避免依赖缺失的 studentT 分布实现
  const z = x;
  const p = 2 * (1 - ss.cumulativeStdNormalProbability(z));
  return Number(p.toFixed(4));
}

function formatResult(rows: (string | number)[][]): AnalysisResult {
  return {
    tables: [
      {
        title: "t检验结果",
        columns: ["类型", "t", "df", "p"],
        rows: rows.map((r) => [r[0], Number((r[1] as number).toFixed(3)), r[2], r[3]])
      }
    ],
    figures: [],
    assumptions: ["正态性", "（独立样本）方差齐性"],
    warnings: [],
    narrative: "p<0.05 表示显著差异；请结合效应量与样本量解读。",
    citation: spec.citation
  };
}

export default { spec, run };
