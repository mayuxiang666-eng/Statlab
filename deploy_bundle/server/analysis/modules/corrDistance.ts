import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { numericValues, distanceCorrelation } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.corr.distance",
  name: "Distance Correlation",
  category: "academic",
  subcategory: "相关性分析",
  description: "捕捉任意形式的关联（线性/非线性），0 代表独立",
  explanation: "普通的相关系数只能捕捉像是「一条直线」般的关系。如果你手头的数据是个Ｕ型或者抛物线的特征，传统算法会觉得它们毫无关系！而距离相关系数能敏锐地发现任何奇形怪状的隐藏关联，为 0 就代表它们真的完全无关。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 2 }
  ],
  paramSchema: [],
  citation: "Székely, Rizzo & Bakirov (2007). Measuring and testing dependence by correlation of distances."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const vars: string[] = variables["variables"] || [];
  const rows: (string | number | null)[][] = [];
  const heat: number[][] = vars.map(() => Array(vars.length).fill(1));

  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const x = numericValues(dataset, vars[i]);
      const y = numericValues(dataset, vars[j]);
      const dcor = distanceCorrelation(x, y);
      rows.push([`${vars[i]} × ${vars[j]}`, Number(dcor.toFixed(3)), Math.min(x.length, y.length)]);
      heat[i][j] = dcor; heat[j][i] = dcor;
    }
  }

  return {
    tables: [{ title: "Distance Correlation", columns: ["配对", "dCor", "n"], rows }],
    figures: [buildHeatmap(vars, heat)],
    assumptions: ["度量任意依赖形式；值越接近 1 依赖越强，0 表示独立"],
    warnings: [],
    narrative: `共 ${rows.length} 对配对。distance correlation 可发现非线性关系，适合探索性分析。`,
    citation: spec.citation
  };
}

function buildHeatmap(vars: string[], mat: number[][]) {
  return {
    title: "Distance Correlation 热力图",
    type: "echarts" as const,
    option: {
      tooltip: { formatter: (p: any) => `${vars[p.value[1]]} × ${vars[p.value[0]]}: ${p.value[2]}` },
      xAxis: { type: "category", data: vars, axisLabel: { rotate: 45, interval: 0 } },
      yAxis: { type: "category", data: vars, axisLabel: { interval: 0 } },
      visualMap: { min: 0, max: 1, orient: "horizontal", left: "center", bottom: 0, inRange: { color: ["#f0f6ff", "#2f81f7"] } },
      series: [{
        type: "heatmap",
        data: mat.flatMap((row, i) => row.map((v, j) => [j, i, Number(Math.max(0, Math.min(1, v)).toFixed(3))])),
        label: { show: true, formatter: (p: any) => Number(p.value[2]).toFixed(2), fontSize: 11 }
      }],
      grid: { left: 10, right: 30, top: 10, bottom: 50, containLabel: true }
    }
  };
}

export default { spec, run };
