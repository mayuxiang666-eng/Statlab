import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, biweightMidcorrelation } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.corr.bicor",
  name: "Biweight Midcorrelation",
  category: "academic",
  subcategory: "相关性分析",
  description: "稳健相关：对离群点降低权重的 biweight midcor",
  explanation: "这是一种比普通皮尔逊更高级、更「抗干扰」的相关算法。如果你的数据里夹杂着个别极端的异常值（比如某天销量突然暴增），普通的算法分析会严重失真，而 Biweight 能聪明地过滤掉异常值的噪音，还原最本真的相关性。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 2 }
  ],
  paramSchema: [],
  citation: "Langfelder & Horvath (2012). Fast R Functions for Robust Correlations."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const vars: string[] = variables["variables"] || [];
  const rows: (string | number | null)[][] = [];
  const heat: number[][] = vars.map(() => Array(vars.length).fill(1));

  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const x = numericValues(dataset, vars[i]);
      const y = numericValues(dataset, vars[j]);
      const r = biweightMidcorrelation(x, y);
      rows.push([`${vars[i]} × ${vars[j]}`, Number(r.toFixed(3)), Math.min(x.length, y.length)]);
      heat[i][j] = r; heat[j][i] = r;
    }
  }

  return {
    tables: [{ title: "Biweight Midcorrelation", columns: ["配对", "bicor", "n"], rows }],
    figures: [buildHeatmap(vars, heat)],
    assumptions: ["中位数与 MAD 为稳健尺度，适合含离群值的数据"],
    warnings: [],
    narrative: `共 ${rows.length} 对配对。bicor 对极端值不敏感，更适合含异常值场景。`,
    citation: spec.citation
  };
}

function buildHeatmap(vars: string[], mat: number[][]) {
  return {
    title: "bicor 热力图",
    type: "echarts" as const,
    option: {
      tooltip: { formatter: (p: any) => `${vars[p.value[1]]} × ${vars[p.value[0]]}: ${p.value[2]}` },
      xAxis: { type: "category", data: vars, axisLabel: { rotate: 45, interval: 0 } },
      yAxis: { type: "category", data: vars, axisLabel: { interval: 0 } },
      visualMap: { min: -1, max: 1, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#f85149", "#f0f6ff", "#2f81f7"] } },
      series: [{
        type: "heatmap",
        data: mat.flatMap((row, i) => row.map((v, j) => [j, i, Number(v.toFixed(3))])),
        label: { show: true, formatter: (p: any) => Number(p.value[2]).toFixed(2), fontSize: 11 }
      }],
      grid: { left: 10, right: 30, top: 10, bottom: 50, containLabel: true }
    }
  };
}

export default { spec, run };
