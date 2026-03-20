import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { cronbachAlpha, numericValues } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.reliability",
  name: "信度 (Cronbach α)",
  category: "academic",
  subcategory: "quality",
  description: "Cronbach’s α + 删题后 α",
  explanation: "主要用于问卷调查，用来回答一个灵魂问题：“大家是不是在认认真真填问卷？”它能测出选项之间的一致性，甚至能抓出那一两道导致大家乱填的“老鼠屎”题目。",
  inputSpec: [
    { id: "items", label: "量表条目", acceptedTypes: ["numeric"], min: 2 }
  ],
  paramSchema: [],
  citation: "Cronbach, L.J. (1951)."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const items = variables["items"] || [];
  if (items.length < 2) throw new Error("至少2个条目");
  const matrix = dataset.map((row: any) => items.map((it: string) => Number(row[it] ?? NaN))).filter((r: number[]) => r.every((x) => !isNaN(x)));
  const alpha = cronbachAlpha(matrix);
  const deleteRows = items.map((it, idx) => {
    const reduced = matrix.map((row) => row.filter((_, j) => j !== idx));
    return [it, Number(cronbachAlpha(reduced).toFixed(3))];
  });
  return {
    tables: [
      { title: "总体信度", columns: ["指标", "值"], rows: [["Cronbach α", Number(alpha.toFixed(3))]] },
      { title: "删题后 α", columns: ["删除条目", "α"], rows: deleteRows }
    ],
    figures: [],
    assumptions: ["条目同质性、单维度假设"],
    warnings: [],
    narrative: "α>0.7 一般认为可接受；若删题后 α 升高，可考虑移除该条目。",
    citation: spec.citation
  };
}

export default { spec, run };
