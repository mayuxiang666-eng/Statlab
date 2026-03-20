import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.kmeans",
  name: "KMeans 聚类 + PCA",
  category: "ml",
  subcategory: "clustering",
  description: "KMeans + 降维可视化 (Python sklearn)",
  explanation: "当你不确定样本属于哪些类别时，它可以帮你无监督地自动“圈地划派”。通过 Python sklearn 实现更专业的聚类分析与 PCA 投影可视化。",
  inputSpec: [
    { id: "features", label: "数值特征", acceptedTypes: ["numeric"], min: 2 }
  ],
  paramSchema: [
    { key: "k", label: "簇数", type: "number", default: 3, min: 2, max: 8 },
  ],
  citation: "MacQueen, J. (1967). Some methods for classification and analysis of multivariate observations."
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.kmeans", dataset, variables, params, onLog);
}

export default { spec, run };
