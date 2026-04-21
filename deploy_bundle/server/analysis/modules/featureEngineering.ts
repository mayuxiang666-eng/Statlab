import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, categoricalCounts } from "../utils";

const spec: AlgorithmSpec = {
  id: "ml.feature",
  name: "特征工程",
  category: "ml",
  subcategory: "prep",
  description: "缺失、标准化、One-Hot、筛选",
  explanation: "这是一套自动化前处理流水线。为了让有些笨笨的算法不要出错，这套流程会自动帮忙“填补空缺的格子”、“把数值拉回同一水平线”甚至“把文字转换成模型认识的独热码数字”。",
  inputSpec: [
    { id: "numeric", label: "数值特征", acceptedTypes: ["numeric"], min: 0 },
    { id: "categorical", label: "分类特征", acceptedTypes: ["categorical"], min: 0 }
  ],
  paramSchema: [
    {
      key: "impute", label: "缺失填补方式", type: "select", default: "mean", options: [
        { label: "均值", value: "mean" },
        { label: "中位数", value: "median" },
        { label: "零填充", value: "zero" }
      ]
    },
    { key: "scale", label: "标准化", type: "boolean", default: true },
    { key: "corrThreshold", label: "相关阈值筛选", type: "number", default: 0.9, min: 0, max: 1, step: 0.05 }
  ],
  citation: "Kuhn & Johnson (2013) Applied Predictive Modeling"
};

async function run({ dataset, variables, params }: any): Promise<AnalysisResult> {
  const numericVars = variables["numeric"] || [];
  const catVars = variables["categorical"] || [];
  const impute = params.impute || "mean";
  const scale = Boolean(params.scale ?? true);
  const corrThreshold = Number(params.corrThreshold ?? 0.9);

  const missingRows: (string | number)[][] = [];
  numericVars.forEach((v: string) => {
    const values = dataset.map((r: any) => r[v]);
    const missing = values.filter((x) => x === undefined || x === "").length;
    missingRows.push([v, missing, impute]);
  });
  catVars.forEach((v: string) => {
    const values = dataset.map((r: any) => r[v]);
    const missing = values.filter((x) => x === undefined || x === "").length;
    missingRows.push([v, missing, "mode"]);
  });

  const corrRows: (string | number)[][] = [];
  for (let i = 0; i < numericVars.length; i++) {
    for (let j = i + 1; j < numericVars.length; j++) {
      const x = numericValues(dataset, numericVars[i]);
      const y = numericValues(dataset, numericVars[j]);
      const cov = correlation(x, y);
      if (Math.abs(cov) > corrThreshold) {
        corrRows.push([`${numericVars[i]}-${numericVars[j]}`, Number(cov.toFixed(3)), "考虑保留其一"]);
      }
    }
  }

  const onehot = catVars.map((v: string) => {
    const levels = Object.keys(categoricalCounts(dataset, v)).length;
    return [v, `${levels} 个虚拟变量`];
  });

  return {
    tables: [
      { title: "缺失处理", columns: ["变量", "缺失数", "策略"], rows: missingRows },
      { title: "相关性筛选", columns: ["配对", "相关", "建议"], rows: corrRows },
      { title: "One-Hot 计划", columns: ["变量", "展开"], rows: onehot }
    ],
    figures: [],
    assumptions: ["数值变量已校验单位/量纲"],
    warnings: [],
    narrative: `建议使用${impute}填补数值缺失，${scale ? "执行" : "跳过"}标准化，相关性阈值为 ${corrThreshold}。`,
    citation: spec.citation
  };
}

function correlation(x: number[], y: number[]) {
  const n = Math.min(x.length, y.length);
  const mx = mean(x.slice(0, n));
  const my = mean(y.slice(0, n));
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / Math.max(arr.length, 1);
}

export default { spec, run };
