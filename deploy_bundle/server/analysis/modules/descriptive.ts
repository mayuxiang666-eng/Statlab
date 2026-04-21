import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, safeMean, safeSd, safeMedian, quartiles } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.descriptive",
  name: "描述性统计",
  category: "academic",
  subcategory: "summary",
  description: "均值/标准差/中位数/四分位数/最小最大/缺失率 + 箱线图",
  explanation: "给懂行老板看的那种“八股文”摘要表。它不仅告诉你平均月薪多少，更是能揪出最高薪最低薪、离群人以及总体的中位水平，配一张“一眼看出大家收入有多大差异”的箱线图。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 1 }
  ],
  paramSchema: [],
  citation: "Field, A. (2013). Discovering statistics using IBM SPSS Statistics."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const vars = variables["variables"] || [];
  const tables = vars.map((v: string) => {
    const values = numericValues(dataset, v);
    const { q1, q3 } = quartiles(values);
    const row = [
      safeMean(values),
      safeSd(values),
      safeMedian(values),
      q1,
      q3,
      Math.min(...values),
      Math.max(...values),
      Number(((dataset.length - values.length) / Math.max(dataset.length, 1)).toFixed(3))
    ].map((n) => Number(n.toFixed(3)));
    return {
      title: `${v} 描述统计`,
      columns: ["均值", "标准差", "中位数", "Q1", "Q3", "最小", "最大", "缺失率"],
      rows: [row]
    };
  });

  // Box plots for each variable
  const figures = vars.map((v: string) => {
    const values = numericValues(dataset, v);
    const { q1, q3 } = quartiles(values);
    const med = safeMedian(values);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const iqr = q3 - q1;
    const low = q1 - 1.5 * iqr;
    const high = q3 + 1.5 * iqr;
    const outliers = values.filter((x) => x < low || x > high).map((x) => [v, x]);
    return {
      title: `${v} 箱线图`,
      type: "echarts" as const,
      option: {
        xAxis: { type: "category", data: [v] },
        yAxis: { type: "value" },
        series: [
          {
            type: "boxplot",
            data: [[mn, q1, med, q3, mx]],
            itemStyle: { color: "rgba(47,129,247,0.3)", borderColor: "#2f81f7" }
          },
          {
            type: "scatter",
            data: outliers,
            symbolSize: 6,
            itemStyle: { color: "#f85149" },
            name: "异常值"
          }
        ],
        tooltip: { trigger: "item" },
        grid: { left: 60, right: 20, top: 20, bottom: 40 }
      }
    };
  });

  return {
    tables,
    figures,
    assumptions: ["已默认数据为独立同分布"],
    warnings: [],
    narrative: `提供${vars.length}个变量的描述统计，适合初步了解分布形态。箱线图展示分布对称性与离群点。`,
    citation: spec.citation
  };
}

export default { spec, run };
