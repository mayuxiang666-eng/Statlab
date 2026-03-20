import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, kendallTau } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.corr.kendall",
  name: "Kendall 相关",
  category: "academic",
  subcategory: "相关性分析",
  description: "Kendall Tau-b 非参数相关，稳健于异常值",
  explanation: "这也是一种防波动的相关性分析，它主要看变量在排名上的「一致性」。它不管数据涨跌幅度多夸张，只关心“你第一我也第一，你垫底我也垫底”的步调是否一致。非常适合用来分析问卷评分、带名次排名这类主观数据。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 2 }
  ],
  paramSchema: [],
  citation: "Kendall, M. (1938). A new measure of rank correlation."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const vars: string[] = variables["variables"] || [];
  const rows: (string | number | null)[][] = [];
  const heatSource = vars.map(() => Array(vars.length).fill(1));

  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const x = numericValues(dataset, vars[i]);
      const y = numericValues(dataset, vars[j]);
      const tau = kendallTau(x, y);
      rows.push([`${vars[i]} × ${vars[j]}`, Number(tau.toFixed(3)), Math.min(x.length, y.length)]);
      heatSource[i][j] = tau; heatSource[j][i] = tau;
    }
  }

  const figures = [buildHeatmap(vars, heatSource, "Kendall τ 热力图")];

  return {
    tables: [{ title: "Kendall 相关系数", columns: ["配对", "τ-b", "n"], rows }],
    figures,
    assumptions: ["非参数秩相关，对非正态与极端值鲁棒"],
    warnings: vars.length > 12 ? ["变量较多，建议关注 |τ| 较大且有理论支撑的配对"] : [],
    narrative: `共 ${rows.length} 对变量，Kendall τ-b 衡量单调相关性，绝对值越大单调关系越强。`,
    citation: spec.citation
  };
}

function buildHeatmap(vars: string[], matrix: number[][], title: string) {
  return {
    title,
    type: "echarts" as const,
    option: {
      tooltip: {
        formatter: (p: any) => `${vars[p.value[1]]} × ${vars[p.value[0]]}: ${p.value[2]}`
      },
      xAxis: { type: "category", data: vars, axisLabel: { rotate: 45, interval: 0 } },
      yAxis: { type: "category", data: vars, axisLabel: { interval: 0 } },
      visualMap: { min: -1, max: 1, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#f85149", "#f0f6ff", "#2f81f7"] } },
      series: [{
        type: "heatmap",
        data: matrix.flatMap((row, i) => row.map((v, j) => [j, i, Number(v.toFixed(3))])),
        label: { show: true, formatter: (p: any) => Number(p.value[2]).toFixed(2), fontSize: 11 }
      }],
      grid: { left: 10, right: 30, top: 10, bottom: 50, containLabel: true }
    }
  };
}

export default { spec, run };
