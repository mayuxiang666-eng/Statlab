import { AlgorithmSpec, AnalysisResult, ParamDef } from "@statlab/shared";
import { partialCorrelationMatrix } from "../utils";

const topParam: ParamDef = { key: "topK", label: "显示前 K 条边(按|ρ|)", type: "number", min: 3, max: 60, step: 1, default: 20 };

const spec: AlgorithmSpec = {
  id: "academic.partial.network",
  name: "Partial Correlation Network",
  category: "academic",
  subcategory: "相关性分析",
  description: "基于偏相关的网络，可视化多变量结构 (控制其他变量)",
  explanation: "普通的两重关联图很容易「被第三者带偏」（比如因为夏天到了，冰棍销量和溺水人数同时上升，但它俩没啥关系）。偏相关图会自动同时分析所有变量，并聪明地剔除「中间商的干扰因素」，最后为你画出一张干净的、展现核心、真实相关关系的网络关系网。",
  inputSpec: [
    { id: "variables", label: "数值变量", acceptedTypes: ["numeric"], min: 3 }
  ],
  paramSchema: [topParam],
  citation: "Epskamp & Fried (2018). A tutorial on regularized partial correlation networks."
};

async function run({ dataset, variables, params }: any): Promise<AnalysisResult> {
  const vars: string[] = variables["variables"] || [];
  const topK = Math.max(topParam.min ?? 3, Math.min(Number(params?.topK ?? topParam.default ?? 20), topParam.max ?? 60));
  const { rho } = partialCorrelationMatrix(dataset, vars);

  const edges: { source: string; target: string; weight: number; sign: string }[] = [];
  for (let i = 0; i < vars.length; i++) {
    for (let j = i + 1; j < vars.length; j++) {
      const r = rho?.[i]?.[j] ?? 0;
      edges.push({ source: vars[i], target: vars[j], weight: Math.abs(r), sign: r >= 0 ? "+" : "-" });
    }
  }
  const sorted = edges.sort((a, b) => b.weight - a.weight).slice(0, topK);

  const tableRows = sorted.map((e) => [`${e.source} ↔ ${e.target}`, Number((e.weight * Math.sign(e.sign === "+" ? 1 : -1)).toFixed(3)), e.sign]);

  const fig = buildGraph(vars, sorted);

  return {
    tables: [{ title: "偏相关强度 (控制其余变量)", columns: ["配对", "ρ_partial", "符号"], rows: tableRows }],
    figures: [fig],
    assumptions: ["线性关系假设；偏相关在控制其他变量后衡量两变量直接关联"],
    warnings: vars.length > 20 ? ["节点较多，建议调小 topK 以保持可读性"] : [],
    narrative: `选取前 ${sorted.length} 条偏相关边，颜色区分正负，边宽按 |ρ| 加权。`,
    citation: spec.citation
  };
}

function buildGraph(vars: string[], edges: { source: string; target: string; weight: number; sign: string }[]) {
  const nodeDegree: Record<string, number> = {};
  edges.forEach((e) => { nodeDegree[e.source] = (nodeDegree[e.source] || 0) + 1; nodeDegree[e.target] = (nodeDegree[e.target] || 0) + 1; });
  const nodes = vars.map((v) => ({
    id: v,
    name: v,
    symbolSize: 24 + (nodeDegree[v] || 0) * 3,
    value: nodeDegree[v] || 0
  }));
  return {
    title: "偏相关网络",
    type: "echarts" as const,
    option: {
      tooltip: { formatter: (p: any) => p.data?.label || `${p.data?.source} ↔ ${p.data?.target}` },
      legend: [{ data: ["正相关", "负相关"], bottom: 0 }],
      series: [{
        type: "graph",
        layout: "force",
        roam: true,
        label: { show: true },
        force: { repulsion: 200, edgeLength: 120 },
        data: nodes,
        edges: edges.map((e) => ({
          source: e.source,
          target: e.target,
          value: Number((e.weight * (e.sign === "+" ? 1 : -1)).toFixed(3)),
          lineStyle: {
            width: Math.max(1, 6 * e.weight),
            color: e.sign === "+" ? "#2f81f7" : "#f85149"
          },
          label: { show: true, formatter: `${e.sign}${e.weight.toFixed(2)}` },
          symbolSize: 6
        })),
        categories: [{ name: "正相关" }, { name: "负相关" }]
      }]
    }
  };
}

export default { spec, run };
