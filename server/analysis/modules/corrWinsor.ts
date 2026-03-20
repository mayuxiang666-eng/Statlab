import { AlgorithmSpec, AnalysisResult, ParamDef } from "@statlab/shared";
import { numericValues, winsorize, corr } from "../utils";

const alphaParam: ParamDef = { key: "alpha", label: "截尾比例 (α)", type: "number", min: 0, max: 0.2, step: 0.01, default: 0.05 };

const spec: AlgorithmSpec = {
  id: "academic.corr.winsor",
  name: "Winsorized Correlation",
  category: "academic",
  subcategory: "相关性分析",
  description: "对上下尾部截尾后的 Pearson 相关，降低异常值影响",
  explanation: "这堪称一招非常粗暴有效的“切萝卜”战术。为了不让那一两个极端的首富拉高大家的平均相关性，这算法直接把金字塔尖顶和垫底的那1%给“切平”，然后再去衡量正常大盘的关联程度。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 2 }
  ],
  paramSchema: [alphaParam],
  citation: "Wilcox, R. (2012). Modern Statistics for the Social and Behavioral Sciences."
};

async function run({ dataset, variables, params }: any): Promise<AnalysisResult> {
  const vars: string[] = variables["variables"] || [];
  const alpha = Number(params?.alpha ?? alphaParam.default ?? 0.05);
  const rows: (string | number | null)[][] = [];
  const heat: number[][] = vars.map(() => Array(vars.length).fill(1));

  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const x = winsorize(numericValues(dataset, vars[i]), alpha);
      const y = winsorize(numericValues(dataset, vars[j]), alpha);
      const r = corr(x, y);
      rows.push([`${vars[i]} × ${vars[j]}`, Number(r.toFixed(3)), Math.min(x.length, y.length)]);
      heat[i][j] = r; heat[j][i] = r;
    }
  }

  return {
    tables: [{ title: `Winsorized 相关 (α=${alpha})`, columns: ["配对", "r", "n"], rows }],
    figures: [buildHeatmap(vars, heat, alpha)],
    assumptions: ["截尾比例 α 默认为 5%，可在参数中调整"],
    warnings: alpha > 0.15 ? ["α 较大，可能过度截尾，注意解释"] : [],
    narrative: `对每列上下 ${Math.round(alpha * 100)}% 进行截尾后计算 Pearson 相关，减少极端值影响。`,
    citation: spec.citation
  };
}

function buildHeatmap(vars: string[], mat: number[][], alpha: number) {
  return {
    title: `Winsorized 热力图 (α=${alpha})`,
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
