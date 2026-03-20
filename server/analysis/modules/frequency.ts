import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { categoricalCounts } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.frequency",
  name: "频数分析",
  category: "academic",
  subcategory: "summary",
  description: "分类频数表 + 柱状图",
  explanation: "最基础的新手入门统计，能最直观地告诉你男生有多少、女生有多少，谁占的比例大，附赠一张清爽的柱状图给你直接复制给老板看。",
  inputSpec: [
    { id: "variables", label: "分类变量", acceptedTypes: ["categorical"], min: 1, max: 3 }
  ],
  paramSchema: [],
  citation: "Agresti, A. (2018). Statistical methods for the social sciences."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const vars = variables["variables"] || [];
  const tables = vars.map((v: string) => {
    const counts = categoricalCounts(dataset, v);
    const rows = Object.entries(counts).map(([k, c]) => [k, c]);
    return { title: `${v} 频数`, columns: ["水平", "频数"], rows };
  });
  const figures = vars.map((v: string) => {
    const counts = categoricalCounts(dataset, v);
    return {
      title: `${v} 柱状图`,
      type: "echarts" as const,
      option: {
        xAxis: { type: "category", data: Object.keys(counts) },
        yAxis: { type: "value" },
        series: [{ type: "bar", data: Object.values(counts) }]
      }
    };
  });
  return {
    tables,
    figures,
    assumptions: ["分类变量互斥"],
    warnings: [],
    narrative: "各分类水平的频数与比例可用于样本结构描述。",
    citation: spec.citation
  };
}

export default { spec, run };
