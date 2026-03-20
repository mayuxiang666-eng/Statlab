import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, shapiroWilk } from "../utils";
import * as ss from "simple-statistics";

const spec: AlgorithmSpec = {
  id: "academic.normality",
  name: "正态性检验",
  category: "academic",
  subcategory: "assumption",
  description: "Shapiro-Wilk + 直方图 + Q-Q图",
  explanation: "大部分高级的数据统计都有一个前提：“大家的数据形状得长得像一口倒扣的钟”。这个算法用直配图、检验数据替你扫描，告诉你这批数据是否达标。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 1, max: 3 }
  ],
  paramSchema: [],
  citation: "Shapiro, S.S., & Wilk, M.B. (1965)."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const vars = variables["variables"] || [];
  const tables = vars.map((v: string) => {
    const values = numericValues(dataset, v);
    const { W, p } = shapiroWilk(values);
    return { title: `${v} 正态性`, columns: ["W", "p"], rows: [[Number(W.toFixed(3)), Number(p.toFixed(3))]] };
  });
  const figures = vars.map((v: string) => {
    const values = numericValues(dataset, v).sort((a, b) => a - b);
    const n = values.length;
    const quantiles = values.map((_, i) => ss.quantileSorted(values, i / (n - 1 || 1)));
    return {
      title: `${v} 直方图/Q-Q`,
      type: "echarts" as const,
      option: {
        tooltip: {},
        dataset: [{ source: values.map((val, i) => [i, val, quantiles[i]]) }],
        grid: [{ left: "5%", width: "40%" }, { right: "5%", width: "40%" }],
        xAxis: [{ gridIndex: 0, type: "value" }, { gridIndex: 1, type: "value" }],
        yAxis: [{ gridIndex: 0, type: "value" }, { gridIndex: 1, type: "value" }],
        series: [
          { type: "histogram", datasetIndex: 0, name: v },
          { type: "scatter", xAxisIndex: 1, yAxisIndex: 1, encode: { x: 1, y: 2 } }
        ]
      }
    };
  });
  return {
    tables,
    figures,
    assumptions: ["样本独立"],
    warnings: [],
    narrative: "p<0.05 说明拒绝正态性，建议使用稳健或非参数方法。",
    citation: spec.citation
  };
}

export default { spec, run };
