import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { chiSquareTest } from "../utils";

const spec: AlgorithmSpec = {
  id: "academic.chisquare",
  name: "卡方检验",
  category: "academic",
  subcategory: "association",
  description: "列联表 + χ² + p",
  explanation: "专门用来评估类别型数据之间是不是只是“巧合”（独立）的卡方检验。比如你想证明“性别”和“他是不是果粉”有没有关系，这就派上用场了。",
  inputSpec: [
    { id: "row", label: "行变量", acceptedTypes: ["categorical"], min: 1, max: 1 },
    { id: "col", label: "列变量", acceptedTypes: ["categorical"], min: 1, max: 1 }
  ],
  paramSchema: [],
  citation: "Pearson, K. (1900)."
};

async function run({ dataset, variables }: any): Promise<AnalysisResult> {
  const rowVar = variables["row"]?.[0];
  const colVar = variables["col"]?.[0];
  if (!rowVar || !colVar) throw new Error("缺少变量");
  const rowCats: string[] = Array.from(new Set<string>(dataset.map((r: any) => String(r[rowVar]))));
  const colCats: string[] = Array.from(new Set<string>(dataset.map((r: any) => String(r[colVar]))));
  const counts = rowCats.map((r) => colCats.map((c) => dataset.filter((d: any) => d[rowVar] === r && d[colVar] === c).length));
  const { chi2, df } = chiSquareTest(counts);
  return {
    tables: [
      { title: "列联表", columns: ["行/列", ...colCats], rows: counts.map((row, i) => [rowCats[i], ...row]) },
      { title: "卡方检验", columns: ["χ²", "df"], rows: [[Number(chi2.toFixed(3)), df]] }
    ],
    figures: [],
    assumptions: ["理论频数不宜过低"],
    warnings: [],
    narrative: "χ² 检验用于分类变量关联，p<0.05 表示显著相关。",
    citation: spec.citation
  };
}

export default { spec, run };
