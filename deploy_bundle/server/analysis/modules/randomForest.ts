import { AlgorithmSpec, AnalysisResult } from "@statlab/shared";
import { callPythonML } from "../pythonBridge";

const spec: AlgorithmSpec = {
  id: "ml.randomForest",
  name: "随机森林分类",
  category: "ml",
  subcategory: "classification",
  description: "集成树分类模型 + 特征重要度 + 混淆矩阵 (Python sklearn)",
  explanation: "随机森林分类通过集成多棵决策树，提升分类预测的准确性和鲁棒性，并能输出 SHAP 特征重要度排名。",
  inputSpec: [
    { id: "target", label: "目标(分类)", acceptedTypes: ["categorical"], min: 1, max: 1 },
    { id: "features", label: "特征", acceptedTypes: ["numeric", "categorical"], min: 1 }
  ],
  paramSchema: [
    { key: "trees", label: "树数量", type: "number", default: 100, min: 10, max: 500, step: 10 },
    { key: "testSize", label: "测试集比例", type: "number", default: 0.3, min: 0.1, max: 0.5, step: 0.05 },
    { key: "cv", label: "交叉验证折数 (0=关闭)", type: "number", default: 0, min: 0, max: 10, step: 1 },
    { key: "impute", label: "缺失值填补", type: "select", options: [{ label: "均值", value: "mean" }, { label: "中位数", value: "median" }, { label: "零", value: "zero" }], default: "mean" },
    { key: "oneHot", label: "自动独热编码 (One-Hot)", type: "boolean", default: true },
  ],
  citation: "Breiman, L. (2001). Random Forests"
};

async function run({ dataset, variables, params, onLog }: any): Promise<AnalysisResult> {
  return callPythonML("ml.randomForest", dataset, variables, params, onLog);
}

export default { spec, run };
